'use client';

import React from 'react';
import Header from '@/components/Header';

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      
      <main className="flex-grow py-12">
        <div className="container max-w-4xl mx-auto">
          <div className="p-10 bg-card rounded-xl shadow-lg">
            <h1 className="text-3xl font-bold text-center mb-10">Privacy Policy</h1>
            
            <div className="max-w-3xl mx-auto space-y-8">
              <div className="mb-6">
                <p className="text-base mb-6">Effective Date: June 15, 2024</p>
                <p className="text-base leading-relaxed">
                  This Privacy Policy describes how your personal information is collected, used, and shared 
                  when you use SyllaScan, our syllabus parsing and organization service. By using any of SyllaScan's Services, 
                  you confirm you have agreed to our Terms of Service and have read and understood this Privacy Policy.
                </p>
              </div>

              <section className="mb-8">
                <h2 className="text-xl font-semibold mb-4">1. Information We Collect</h2>
                <p className="text-base leading-relaxed mb-4">
                  When you use SyllaScan, we collect several types of information, including:
                </p>
                
                <p className="text-base leading-relaxed mb-2 pl-6">
                  <strong>Account Information:</strong> When you create an account, we collect your name, email address, and 
                  other profile information. This information is used to identify you and provide access to our services.
                </p>
                
                <p className="text-base leading-relaxed mb-2 pl-6">
                  <strong>Syllabus Content:</strong> We collect and process the content of the syllabi you upload, including course details, 
                  assignment information, deadlines, and other academic information contained within the documents.
                </p>
                
                <p className="text-base leading-relaxed pl-6">
                  <strong>Usage Information:</strong> We collect information about how you interact with our service, including the features you use, 
                  the time spent on the platform, and your interactions with syllabi and extracted data.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-xl font-semibold mb-4">2. How We Use Your Information</h2>
                <p className="text-base leading-relaxed mb-4">
                  We use the information we collect to:
                </p>
                <ul className="pl-6 list-disc space-y-2">
                  <li className="text-base">Provide, maintain, and improve our services</li>
                  <li className="text-base">Process and analyze the syllabi you upload</li>
                  <li className="text-base">Create and maintain your account</li>
                  <li className="text-base">Communicate with you about service updates and changes</li>
                  <li className="text-base">Monitor and analyze usage patterns and trends</li>
                  <li className="text-base">Detect, prevent, and address technical issues</li>
                </ul>
              </section>

              <section className="mb-8">
                <h2 className="text-xl font-semibold mb-4">3. Information Sharing</h2>
                <p className="text-base leading-relaxed mb-4">
                  We do not sell or rent your personal information to third parties. We may share your information in the following circumstances:
                </p>
                
                <p className="text-base leading-relaxed mb-3 pl-6">
                  <strong>Service Providers:</strong> We may share your information with third-party vendors, service providers, and other business partners 
                  who need access to such information to help us provide our services.
                </p>
                
                <p className="text-base leading-relaxed mb-3 pl-6">
                  <strong>Legal Requirements:</strong> We may disclose your information when required by law or in response to valid requests by public 
                  authorities (e.g., a court or government agency).
                </p>
                
                <p className="text-base leading-relaxed pl-6">
                  <strong>Business Transfers:</strong> If SyllaScan is involved in a merger, acquisition, or sale of all or a portion of its assets, your 
                  information may be transferred as part of that transaction.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-xl font-semibold mb-4">4. Data Security</h2>
                <p className="text-base leading-relaxed">
                  We implement appropriate technical and organizational measures to protect the security of your personal information. 
                  While we strive to use commercially acceptable means to protect your personal information, no method of 
                  transmission over the Internet or method of electronic storage is 100% secure. We cannot guarantee absolute security.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-xl font-semibold mb-4">5. Your Rights and Choices</h2>
                <p className="text-base leading-relaxed mb-4">
                  Depending on your location, you may have certain rights regarding your personal information, including:
                </p>
                
                <ul className="pl-6 list-disc space-y-2">
                  <li className="text-base"><strong>Access:</strong> You can request access to the personal information we have about you.</li>
                  <li className="text-base"><strong>Correction:</strong> You can request that we correct inaccurate or incomplete information.</li>
                  <li className="text-base"><strong>Deletion:</strong> You can request that we delete your personal information.</li>
                  <li className="text-base"><strong>Data Portability:</strong> You can request a copy of your data in a structured, commonly used format.</li>
                </ul>
                
                <p className="text-base leading-relaxed mt-4">
                  To exercise any of these rights, please contact us at privacy@syllascan.com. We will respond to your request 
                  within a reasonable timeframe, typically within 30 days.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-xl font-semibold mb-4">6. Data Retention</h2>
                <p className="text-base leading-relaxed">
                  We retain your personal information for as long as necessary to provide you with our services and as needed 
                  to comply with our legal obligations, resolve disputes, and enforce our agreements. When we no longer need 
                  to use your data, we will either delete it or anonymize it.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-xl font-semibold mb-4">7. Children's Privacy</h2>
                <p className="text-base leading-relaxed">
                  Our service is not intended for children under the age of 13. We do not knowingly collect personal information 
                  from children under 13. If you are a parent or guardian and you are aware that your child has provided us with 
                  personal information, please contact us so that we can take appropriate action.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-xl font-semibold mb-4">8. Changes to this Privacy Policy</h2>
                <p className="text-base leading-relaxed">
                  We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new 
                  Privacy Policy on this page and updating the "Effective Date" at the top. You are advised to review this 
                  Privacy Policy periodically for any changes.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-xl font-semibold mb-4">9. Contact Us</h2>
                <p className="text-base leading-relaxed mb-4">
                  If you have any questions about this Privacy Policy, please contact us at:
                </p>
                <p className="text-base">privacy@syllascan.com</p>
              </section>
            </div>
          </div>
        </div>
      </main>
      
      <footer className="app-footer">
        <div className="container">
          <p className="footer-text">
            &copy; {new Date().getFullYear()} SyllaScan. All rights reserved. Built by Martin
            {' | '}
            <a href="/privacy-policy" className="footer-link hover:underline">Privacy Policy</a>
            {' | '}
            <a href="/terms-of-service" className="footer-link hover:underline">Terms of Service</a>
          </p>
        </div>
      </footer>
      
      <style jsx>{`
        .app-footer {
          background-color: var(--card);
          padding: 2rem 0;
          margin-top: 3rem;
          border-top: 1px solid var(--border);
        }
        
        .footer-text {
          text-align: center;
          color: var(--foreground);
          opacity: 0.6;
          font-size: 0.875rem;
        }
        
        .footer-link {
          color: var(--primary);
          font-weight: 500;
        }
        
        /* For dark mode */
        :global(.dark) .footer-link {
          color: var(--primary-light);
          opacity: 0.9;
        }
      `}</style>
    </div>
  );
} 