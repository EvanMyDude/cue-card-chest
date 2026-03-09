import { Link } from 'react-router-dom';

const PrivacyPolicy = () => {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
        <Link
          to="/"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8"
        >
          ← Back to Prompt Library
        </Link>

        <h1 className="text-3xl font-bold mb-2">Privacy Policy</h1>
        <p className="text-sm text-muted-foreground mb-8">Last updated: March 9, 2026</p>

        <div className="space-y-8 text-sm leading-relaxed text-muted-foreground">
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">1. Information We Collect</h2>
            <p>
              When you create an account, we collect your email address through our authentication provider.
              When you use the sync feature, your prompts (titles, content, and tags) are stored in our database.
              We do not collect any information beyond what is necessary to provide the service.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">2. How We Use Your Information</h2>
            <p>
              We use your information solely to provide and improve AI Prompt Library. Specifically:
            </p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Your email address is used for account authentication and login.</li>
              <li>Your prompts are stored to enable cloud sync across your devices.</li>
              <li>We do not sell, share, or use your data for advertising purposes.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">3. Third-Party Services</h2>
            <p>We use the following third-party services:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li><strong className="text-foreground">Supabase</strong> — Database hosting, user authentication, and data storage.</li>
              <li><strong className="text-foreground">Google</strong> — OAuth sign-in (if you choose to sign in with Google).</li>
              <li><strong className="text-foreground">Cloudflare Pages</strong> — Application hosting.</li>
            </ul>
            <p className="mt-2">
              Each of these services has its own privacy policy governing how they handle your data.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">4. Data Storage & Security</h2>
            <p>
              Your prompts can be stored locally in your browser (localStorage) and optionally synced to
              our cloud database hosted by Supabase. All data in transit is encrypted via HTTPS.
              Database access is protected by row-level security policies — you can only access your own data.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">5. Data Retention & Deletion</h2>
            <p>
              Your data is retained as long as your account is active. You may delete individual prompts
              at any time. To delete your account and all associated data, please contact us at the
              email address below.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">6. Cookies & Local Storage</h2>
            <p>
              We do not use tracking cookies. We use browser localStorage to store your authentication
              session token (managed by Supabase) and your locally saved prompts. No third-party
              tracking or analytics cookies are used.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">7. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. Changes will be reflected on this page
              with an updated "Last updated" date. Continued use of the service after changes constitutes
              acceptance of the revised policy.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">8. Contact</h2>
            <p>
              If you have questions about this Privacy Policy, please contact us at{' '}
              <a href="mailto:contact@aipromptlibrary.com" className="text-primary hover:underline">
                contact@aipromptlibrary.com
              </a>.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
