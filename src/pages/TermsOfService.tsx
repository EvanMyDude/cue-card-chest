import { Link } from 'react-router-dom';

const TermsOfService = () => {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
        <Link
          to="/"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8"
        >
          ← Back to Prompt Library
        </Link>

        <h1 className="text-3xl font-bold mb-2">Terms of Service</h1>
        <p className="text-sm text-muted-foreground mb-8">Last updated: March 9, 2026</p>

        <div className="space-y-8 text-sm leading-relaxed text-muted-foreground">
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">1. Acceptance of Terms</h2>
            <p>
              By accessing or using AI Prompt Library ("the Service"), you agree to be bound by these
              Terms of Service. If you do not agree, please do not use the Service.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">2. Description of Service</h2>
            <p>
              AI Prompt Library is a web application for storing, organizing, and syncing AI prompts.
              The Service works offline via local browser storage and offers optional cloud sync
              through user authentication.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">3. User Accounts</h2>
            <p>
              You may use the Service without an account (local-only mode). To enable cloud sync,
              you must create an account using a valid email address or Google sign-in. You are
              responsible for maintaining the security of your account credentials.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">4. Content Ownership</h2>
            <p>
              You retain full ownership of all prompts and content you create using the Service.
              We do not claim any intellectual property rights over your content. By using cloud sync,
              you grant us a limited license to store and transmit your content solely for the purpose
              of providing the Service.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">5. Prohibited Use</h2>
            <p>You agree not to:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Use the Service for any unlawful purpose.</li>
              <li>Attempt to gain unauthorized access to the Service or its systems.</li>
              <li>Interfere with or disrupt the Service or its infrastructure.</li>
              <li>Use automated systems to access the Service in a manner that exceeds reasonable use.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">6. Disclaimers</h2>
            <p>
              The Service is provided "as is" and "as available" without warranties of any kind,
              either express or implied. We do not guarantee that the Service will be uninterrupted,
              error-free, or secure. Use of the Service is at your own risk.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">7. Limitation of Liability</h2>
            <p>
              To the fullest extent permitted by law, we shall not be liable for any indirect,
              incidental, special, consequential, or punitive damages, or any loss of data, profits,
              or goodwill arising from your use of the Service.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">8. Changes to These Terms</h2>
            <p>
              We may update these Terms from time to time. Changes will be reflected on this page
              with an updated "Last updated" date. Continued use of the Service after changes
              constitutes acceptance of the revised terms.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">9. Contact</h2>
            <p>
              If you have questions about these Terms, please contact us at{' '}
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

export default TermsOfService;
