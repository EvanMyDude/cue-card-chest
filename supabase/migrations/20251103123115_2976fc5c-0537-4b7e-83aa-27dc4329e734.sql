-- ============================================
-- Phase 1: Offline-First Prompt Library Migration
-- Creates tables, RLS policies, indexes, and helper functions
-- ============================================

-- Create custom types
CREATE TYPE public.app_role AS ENUM ('admin', 'user');
CREATE TYPE public.sync_status AS ENUM ('pending', 'synced', 'conflict');

-- ============================================
-- TABLES
-- ============================================

-- Devices table (track user devices)
CREATE TABLE public.devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  device_name TEXT NOT NULL,
  device_type TEXT, -- 'desktop', 'mobile', 'tablet'
  last_seen_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, device_name)
);

-- Prompts table (main data with version-based conflict detection)
CREATE TABLE public.prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  device_id UUID REFERENCES public.devices(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  checksum TEXT NOT NULL, -- SHA-256 hash of normalized content for dedupe
  tokens INTEGER DEFAULT 0,
  is_pinned BOOLEAN DEFAULT false,
  order_index INTEGER DEFAULT 0,
  version INTEGER DEFAULT 1,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tags table
CREATE TABLE public.tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, name)
);

-- Prompt-Tag junction table
CREATE TABLE public.prompt_tags (
  prompt_id UUID REFERENCES public.prompts(id) ON DELETE CASCADE NOT NULL,
  tag_id UUID REFERENCES public.tags(id) ON DELETE CASCADE NOT NULL,
  PRIMARY KEY (prompt_id, tag_id)
);

-- Prompt revisions (conflict history for manual resolution)
CREATE TABLE public.prompt_revisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_id UUID REFERENCES public.prompts(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  checksum TEXT NOT NULL,
  version INTEGER NOT NULL,
  device_id UUID REFERENCES public.devices(id) ON DELETE SET NULL,
  conflict_resolved BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Sync state tracking per device
CREATE TABLE public.sync_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  device_id UUID REFERENCES public.devices(id) ON DELETE CASCADE NOT NULL,
  last_sync_at TIMESTAMPTZ DEFAULT now(),
  sync_status sync_status DEFAULT 'synced',
  error_message TEXT,
  UNIQUE(user_id, device_id)
);

-- User roles table (separate from profiles for security)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'user',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, role)
);

-- ============================================
-- INDEXES
-- ============================================

-- Prompts indexes (optimized for user queries and sync)
CREATE INDEX idx_prompts_user_id ON public.prompts(user_id);
CREATE INDEX idx_prompts_archived ON public.prompts(user_id, archived_at) WHERE archived_at IS NULL;
CREATE INDEX idx_prompts_checksum ON public.prompts(checksum);
CREATE INDEX idx_prompts_updated ON public.prompts(user_id, updated_at DESC);

-- Tags indexes
CREATE INDEX idx_tags_user_id ON public.tags(user_id);

-- Junction table indexes
CREATE INDEX idx_prompt_tags_prompt ON public.prompt_tags(prompt_id);
CREATE INDEX idx_prompt_tags_tag ON public.prompt_tags(tag_id);

-- Revisions index
CREATE INDEX idx_revisions_prompt ON public.prompt_revisions(prompt_id);
CREATE INDEX idx_revisions_unresolved ON public.prompt_revisions(prompt_id, conflict_resolved) WHERE conflict_resolved = false;

-- Devices index
CREATE INDEX idx_devices_user ON public.devices(user_id);

-- Sync state index
CREATE INDEX idx_sync_state_user ON public.sync_state(user_id);

-- ============================================
-- ENABLE ROW LEVEL SECURITY
-- ============================================

ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prompt_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prompt_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- ============================================
-- SECURITY DEFINER FUNCTION (Prevents RLS recursion)
-- ============================================

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- ============================================
-- RLS POLICIES
-- ============================================

-- Devices policies (users manage their own devices)
CREATE POLICY "Users can view own devices" ON public.devices
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own devices" ON public.devices
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own devices" ON public.devices
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own devices" ON public.devices
  FOR DELETE USING (auth.uid() = user_id);

-- Prompts policies (users only see non-archived prompts)
CREATE POLICY "Users can view own non-archived prompts" ON public.prompts
  FOR SELECT USING (auth.uid() = user_id AND archived_at IS NULL);

CREATE POLICY "Users can insert own prompts" ON public.prompts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own prompts" ON public.prompts
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can soft-delete own prompts" ON public.prompts
  FOR DELETE USING (auth.uid() = user_id);

-- Tags policies
CREATE POLICY "Users can view own tags" ON public.tags
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own tags" ON public.tags
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own tags" ON public.tags
  FOR DELETE USING (auth.uid() = user_id);

-- Prompt_tags policies (junction table access via prompts ownership)
CREATE POLICY "Users can view own prompt_tags" ON public.prompt_tags
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.prompts WHERE id = prompt_id AND user_id = auth.uid())
  );

CREATE POLICY "Users can insert own prompt_tags" ON public.prompt_tags
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.prompts WHERE id = prompt_id AND user_id = auth.uid())
  );

CREATE POLICY "Users can delete own prompt_tags" ON public.prompt_tags
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.prompts WHERE id = prompt_id AND user_id = auth.uid())
  );

-- Prompt_revisions policies (conflict history)
CREATE POLICY "Users can view own revisions" ON public.prompt_revisions
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.prompts WHERE id = prompt_id AND user_id = auth.uid())
  );

CREATE POLICY "Users can insert revisions for own prompts" ON public.prompt_revisions
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.prompts WHERE id = prompt_id AND user_id = auth.uid())
  );

CREATE POLICY "Users can update own revisions" ON public.prompt_revisions
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.prompts WHERE id = prompt_id AND user_id = auth.uid())
  );

-- Sync_state policies
CREATE POLICY "Users can view own sync_state" ON public.sync_state
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can upsert own sync_state" ON public.sync_state
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sync_state" ON public.sync_state
  FOR UPDATE USING (auth.uid() = user_id);

-- User_roles policies (users view own, admins manage all)
CREATE POLICY "Users can view own roles" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all roles" ON public.user_roles
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Compute SHA-256 checksum for dedupe (normalizes title + content)
CREATE OR REPLACE FUNCTION public.compute_checksum(p_title TEXT, p_content TEXT)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN encode(
    digest(
      jsonb_build_object(
        'title', TRIM(p_title), 
        'content', TRIM(p_content)
      )::text, 
      'sha256'
    ), 
    'hex'
  );
END;
$$;

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Auto-compute checksum on insert/update
CREATE OR REPLACE FUNCTION public.handle_prompt_checksum()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.checksum = public.compute_checksum(NEW.title, NEW.content);
  RETURN NEW;
END;
$$;

-- ============================================
-- TRIGGERS
-- ============================================

-- Trigger: auto-update updated_at on prompts
CREATE TRIGGER prompts_updated_at 
BEFORE UPDATE ON public.prompts
FOR EACH ROW 
EXECUTE FUNCTION public.handle_updated_at();

-- Trigger: auto-compute checksum on prompts insert/update
CREATE TRIGGER prompts_checksum 
BEFORE INSERT OR UPDATE ON public.prompts
FOR EACH ROW 
EXECUTE FUNCTION public.handle_prompt_checksum();

-- ============================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================

COMMENT ON TABLE public.prompts IS 'Main prompts table with version-based conflict detection and checksum-based deduplication';
COMMENT ON COLUMN public.prompts.checksum IS 'SHA-256 hash of normalized title+content for import deduplication';
COMMENT ON COLUMN public.prompts.version IS 'Incremented on each update for conflict detection';
COMMENT ON TABLE public.prompt_revisions IS 'Stores conflicting versions when updates occur >30s apart on different devices';
COMMENT ON FUNCTION public.has_role IS 'Security definer function to check user roles without RLS recursion';
COMMENT ON FUNCTION public.compute_checksum IS 'Generates consistent SHA-256 hash for dedupe during import';