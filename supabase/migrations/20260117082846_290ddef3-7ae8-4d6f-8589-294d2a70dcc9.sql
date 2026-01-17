-- Create prompt_packs table
CREATE TABLE public.prompt_packs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on prompt_packs
ALTER TABLE public.prompt_packs ENABLE ROW LEVEL SECURITY;

-- Public read access for active packs (no auth required)
CREATE POLICY "Anyone can view active packs"
ON public.prompt_packs
FOR SELECT
USING (is_active = true);

-- Create pack_prompts table
CREATE TABLE public.pack_prompts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pack_id UUID NOT NULL REFERENCES public.prompt_packs(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  order_index INTEGER NOT NULL DEFAULT 0,
  checksum TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on pack_prompts
ALTER TABLE public.pack_prompts ENABLE ROW LEVEL SECURITY;

-- Public read access for pack prompts (inherits from pack visibility)
CREATE POLICY "Anyone can view prompts in active packs"
ON public.pack_prompts
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.prompt_packs
  WHERE prompt_packs.id = pack_prompts.pack_id
  AND prompt_packs.is_active = true
));

-- Add source tracking columns to prompts table
ALTER TABLE public.prompts
ADD COLUMN source_pack_id UUID REFERENCES public.prompt_packs(id) ON DELETE SET NULL,
ADD COLUMN source_pack_version INTEGER;

-- Create trigger for pack_prompts checksum (reuse existing function pattern)
CREATE OR REPLACE FUNCTION public.handle_pack_prompt_checksum()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  NEW.checksum = public.compute_checksum(NEW.title, NEW.content);
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_pack_prompt_checksum
BEFORE INSERT OR UPDATE ON public.pack_prompts
FOR EACH ROW
EXECUTE FUNCTION public.handle_pack_prompt_checksum();

-- Create updated_at trigger for prompt_packs
CREATE TRIGGER update_prompt_packs_updated_at
BEFORE UPDATE ON public.prompt_packs
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- Seed the starter pack
INSERT INTO public.prompt_packs (id, name, description, version, is_active)
VALUES (
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'AI Prompting Essentials',
  'A curated collection of foundational prompts to help you get the most out of AI assistants.',
  1,
  true
);

-- Seed pack prompts
INSERT INTO public.pack_prompts (pack_id, title, content, order_index, checksum) VALUES
(
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'Expert Persona',
  'You are a world-class expert in [FIELD]. Explain [TOPIC] as if teaching a motivated beginner. Use clear analogies, provide practical examples, and anticipate common misconceptions.',
  0,
  public.compute_checksum('Expert Persona', 'You are a world-class expert in [FIELD]. Explain [TOPIC] as if teaching a motivated beginner. Use clear analogies, provide practical examples, and anticipate common misconceptions.')
),
(
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'Step-by-Step Breakdown',
  'Break down the following task into clear, numbered steps. For each step, explain what to do and why it matters. Task: [TASK]',
  1,
  public.compute_checksum('Step-by-Step Breakdown', 'Break down the following task into clear, numbered steps. For each step, explain what to do and why it matters. Task: [TASK]')
),
(
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'Pros and Cons Analysis',
  'Analyze [TOPIC/DECISION] by listing the top 5 pros and top 5 cons. For each point, provide a brief explanation. End with a balanced recommendation.',
  2,
  public.compute_checksum('Pros and Cons Analysis', 'Analyze [TOPIC/DECISION] by listing the top 5 pros and top 5 cons. For each point, provide a brief explanation. End with a balanced recommendation.')
),
(
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'Code Review Helper',
  'Review the following code for: 1) Bugs and edge cases, 2) Performance issues, 3) Readability improvements, 4) Security concerns. Provide specific suggestions with code examples where helpful.

```
[PASTE CODE HERE]
```',
  3,
  public.compute_checksum('Code Review Helper', 'Review the following code for: 1) Bugs and edge cases, 2) Performance issues, 3) Readability improvements, 4) Security concerns. Provide specific suggestions with code examples where helpful.

```
[PASTE CODE HERE]
```')
),
(
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'Summarize and Extract',
  'Read the following text and provide: 1) A 2-sentence summary, 2) The 3 most important points, 3) Any action items or next steps mentioned.

Text: [PASTE TEXT]',
  4,
  public.compute_checksum('Summarize and Extract', 'Read the following text and provide: 1) A 2-sentence summary, 2) The 3 most important points, 3) Any action items or next steps mentioned.

Text: [PASTE TEXT]')
);