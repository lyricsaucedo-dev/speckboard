import { Link } from 'react-router-dom';

function LegalShell({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <article className="legal-page">
      <p className="legal-kicker">
        <Link to="/">← Speckboard</Link>
      </p>
      <h1>{title}</h1>
      <p className="legal-updated">Last updated: September 5, 2026 · Placeholder jurisdiction: Delaware, USA</p>
      <div className="legal-body">{children}</div>
    </article>
  );
}

export function TermsPage() {
  return (
    <LegalShell title="Terms of Service">
      <p>
        These Terms govern your use of Speckboard (“Service”), a pixel advertising board where users
        may purchase regions of a digital grid and display user-supplied creatives.
      </p>
      <h2>1. Eligibility</h2>
      <p>You must be at least 18 years old and able to form a binding contract.</p>
      <h2>2. Purchases</h2>
      <p>
        Pixels are priced at $0.25 each. Payment is processed by Stripe. Purchases grant a limited,
        non-exclusive, revocable license to display your creative in the purchased region(s) for as
        long as Speckboard operates and your content complies with these Terms and our Acceptable
        Use Policy. Purchases do not convey ownership of Speckboard, the platform, or any trademark.
      </p>
      <h2>3. Guest vs signed-in purchases</h2>
      <p>
        If you purchase while signed out, your creative (title, image, link) is collected before
        payment and is locked after purchase — you cannot edit those pixels later. Signing in before
        purchase attaches pixels to your account so you can edit and buy more later.
      </p>
      <h2>4. No endorsement</h2>
      <p>
        Speckboard does not endorse, verify, or guarantee any advertised product, service, claim, or
        third-party site. Display on the board is not an affiliation or recommendation.
      </p>
      <h2>5. Content warranty & removal</h2>
      <p>
        You warrant you have all rights to the creative and linked destination. We may remove,
        blur, or disable any ad that violates law, these Terms, Acceptable Use, DMCA notices, or
        that we reasonably believe creates legal or safety risk — with or without notice. No refunds
        for removals due to policy or legal violations.
      </p>
      <h2>6. Refunds</h2>
      <p>
        Except where required by law, sales are final once payment succeeds. Policy violations do
        not entitle you to a refund.
      </p>
      <h2>7. Limitation of liability</h2>
      <p>
        TO THE MAXIMUM EXTENT PERMITTED BY LAW, SPECKBOARD AND ITS OPERATORS ARE NOT LIABLE FOR
        INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS,
        DATA, OR GOODWILL. OUR TOTAL LIABILITY FOR ANY CLAIM RELATED TO THE SERVICE SHALL NOT EXCEED
        THE AMOUNT YOU PAID TO SPECKBOARD IN THE TWELVE (12) MONTHS PRECEDING THE CLAIM.
      </p>
      <h2>8. Disclaimer of warranties</h2>
      <p>
        THE SERVICE IS PROVIDED “AS IS” AND “AS AVAILABLE” WITHOUT WARRANTIES OF ANY KIND, EXPRESS
        OR IMPLIED, INCLUDING MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND
        NON-INFRINGEMENT.
      </p>
      <h2>9. Indemnity</h2>
      <p>
        You agree to indemnify and hold harmless Speckboard from claims arising out of your content,
        links, purchases, or misuse of the Service.
      </p>
      <h2>10. Governing law</h2>
      <p>
        These Terms are governed by the laws of the State of Delaware, USA (placeholder), without
        regard to conflict-of-law rules. Exclusive venue lies in state or federal courts located in
        Delaware, unless mandatory consumer law provides otherwise.
      </p>
      <h2>11. Changes</h2>
      <p>We may update these Terms; continued use after posting constitutes acceptance.</p>
    </LegalShell>
  );
}

export function PrivacyPage() {
  return (
    <LegalShell title="Privacy Policy">
      <p>
        This Privacy Policy explains how Speckboard collects, uses, and shares information when you
        use the Service.
      </p>
      <h2>Information we collect</h2>
      <ul>
        <li>Account data: email, password hash, optional display name.</li>
        <li>Purchase data: pixel regions, creative URLs/titles, amounts, Stripe session IDs.</li>
        <li>Technical data: IP address, browser type, session cookies for authentication.</li>
        <li>Payment data is processed by Stripe; we do not store full card numbers.</li>
      </ul>
      <h2>How we use information</h2>
      <ul>
        <li>Operate the board, fulfill purchases, and provide account dashboards.</li>
        <li>Prevent fraud, enforce policies, and respond to legal requests.</li>
        <li>Communicate about your account or purchases when needed.</li>
      </ul>
      <h2>Sharing</h2>
      <p>
        We share data with processors such as Stripe (payments) and hosting providers as needed to
        run the Service. We may disclose information if required by law or to protect rights and
        safety.
      </p>
      <h2>Retention</h2>
      <p>
        We retain account and ad records while your content remains on the board and as needed for
        legal, accounting, and dispute purposes.
      </p>
      <h2>Your choices</h2>
      <p>
        You may update account creatives when signed in (for non-locked purchases). Contact us to
        request account deletion subject to legal retention needs.
      </p>
      <h2>Children</h2>
      <p>The Service is not directed to individuals under 18.</p>
      <h2>Contact</h2>
      <p>privacy@speckboard.example (placeholder)</p>
    </LegalShell>
  );
}

export function AupPage() {
  return (
    <LegalShell title="Acceptable Use & Content Policy">
      <p>
        All creatives and destination links must comply with this policy. Violations may result in
        removal without refund.
      </p>
      <h2>Prohibited content</h2>
      <ul>
        <li>Illegal goods/services, scams, phishing, malware, or unauthorized access tools.</li>
        <li>CSAM, exploitation, or sexual content involving minors.</li>
        <li>Non-consensual intimate imagery, doxxing, or targeted harassment.</li>
        <li>Hate speech or calls to violence against protected classes.</li>
        <li>Infringing copyrights, trademarks, or other IP without authorization.</li>
        <li>Misrepresentation that Speckboard endorses your product or message.</li>
        <li>Deceptive claims, impersonation, or counterfeit goods.</li>
      </ul>
      <h2>Creative requirements</h2>
      <ul>
        <li>You must have rights to images and permission to link to the destination.</li>
        <li>Ads must not auto-download files or attempt to exploit browser vulnerabilities.</li>
        <li>Adult content, if any, must comply with law and may be restricted or removed at our discretion.</li>
      </ul>
      <h2>Enforcement</h2>
      <p>
        We may remove content, suspend accounts, and cooperate with law enforcement. No refunds for
        policy violations.
      </p>
    </LegalShell>
  );
}

export function DmcaPage() {
  return (
    <LegalShell title="DMCA / Copyright Policy">
      <p>
        Speckboard respects intellectual property rights. If you believe content on the board
        infringes your copyright, send a notice including:
      </p>
      <ul>
        <li>Your physical or electronic signature.</li>
        <li>Identification of the copyrighted work claimed to be infringed.</li>
        <li>Identification of the material (pixel coordinates / ad URL) and location on Speckboard.</li>
        <li>Your contact information.</li>
        <li>A statement of good-faith belief that use is not authorized.</li>
        <li>
          A statement, under penalty of perjury, that the information is accurate and that you are
          the owner or authorized to act.
        </li>
      </ul>
      <p>
        Designated Copyright Agent (placeholder): dmca@speckboard.example · Speckboard Legal, 100
        Pixel Ave, Wilmington, DE 19801, USA.
      </p>
      <p>
        Counter-notices may be submitted by users whose content was removed. Repeat infringers may
        lose access. This page is provided for compliance orientation and is not legal advice.
      </p>
    </LegalShell>
  );
}
