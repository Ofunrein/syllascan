'use client';

import React from 'react';
import Header from '@/components/Header';

export default function TermsOfService() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      
      <main className="flex-grow py-12">
        <div className="container max-w-4xl mx-auto">
          <div className="p-10 bg-card rounded-xl shadow-lg">
            <h1 className="text-3xl font-bold text-center mb-10">Terms of Service</h1>
            
            <div className="max-w-3xl mx-auto space-y-8">
              <div className="mb-6">
                <p className="text-base mb-6">Effective Date: June 15, 2024</p>
                <p className="text-base leading-relaxed">
                  Please read these Terms of Service ("Terms") carefully before using the SyllaScan 
                  service. By accessing or using the service, you agree to be bound by these Terms.
                </p>
              </div>

              <section className="mb-8">
                <h2 className="text-xl font-semibold mb-4">1. Agreement to Terms</h2>
                <p className="text-base leading-relaxed">
                  By accessing or using our Service, you agree to these Terms. If you disagree with any 
                  part of the Terms, you may not access the Service. These Terms apply to all visitors, 
                  users, and others who wish to access or use the Service.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-xl font-semibold mb-4">2. Description of Service</h2>
                <p className="text-base leading-relaxed mb-4">
                  SyllaScan is an educational tool designed to extract, organize, and analyze 
                  information from course syllabi. The Service enables users to upload syllabi, extract 
                  structured data, and organize academic information. Features may include:
                </p>
                <ul className="pl-6 list-disc space-y-2">
                  <li className="text-base">Syllabus parsing and data extraction</li>
                  <li className="text-base">Course information organization</li>
                  <li className="text-base">Academic calendar integration</li>
                  <li className="text-base">Assignment and deadline tracking</li>
                </ul>
              </section>

              <section className="mb-8">
                <h2 className="text-xl font-semibold mb-4">3. User Accounts</h2>
                <p className="text-base leading-relaxed mb-2 pl-6">
                  <strong>Registration:</strong> To use certain features of the Service, you may be required to register for an account. 
                  You agree to provide accurate, current, and complete information during the registration process and to update 
                  such information to keep it accurate, current, and complete.
                </p>
                
                <p className="text-base leading-relaxed pl-6">
                  <strong>Account Security:</strong> You are responsible for maintaining the confidentiality of your account and password and for 
                  restricting access to your computer. You agree to accept responsibility for all activities that 
                  occur under your account.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-xl font-semibold mb-4">4. Intellectual Property</h2>
                <p className="text-base leading-relaxed mb-4">
                  The Service and its original content (excluding content provided by users), features, and functionality 
                  are and will remain the exclusive property of SyllaScan and its licensors.
                </p>
                <p className="text-base leading-relaxed">
                  The Service is protected by copyright, trademark, and other laws of both the United States and foreign countries. 
                  Our trademarks and trade dress may not be used in connection with any product or service without the prior written 
                  consent of SyllaScan.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-xl font-semibold mb-4">5. User Content</h2>
                <p className="text-base leading-relaxed mb-4">
                  Our Service allows you to upload, store, share, and otherwise make available certain information, text, or other material ("User Content"). 
                  You retain any and all rights to your User Content.
                </p>
                <p className="text-base leading-relaxed mb-4">
                  By submitting User Content to the Service, you grant us a worldwide, non-exclusive, royalty-free license to use, reproduce, modify, 
                  publish, and display such User Content solely for the purpose of providing and improving the Service.
                </p>
                <p className="text-base leading-relaxed">
                  You represent and warrant that your User Content does not violate the rights of any third party, including copyright, trademark, 
                  privacy, or other personal or proprietary rights.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-xl font-semibold mb-4">6. Prohibited Uses</h2>
                <p className="text-base leading-relaxed mb-4">
                  You agree not to use the Service in any way that:
                </p>
                <ul className="pl-6 list-disc space-y-2">
                  <li className="text-base">Violates any applicable law or regulation</li>
                  <li className="text-base">Infringes the rights of any third party</li>
                  <li className="text-base">Attempts to interfere with the proper functioning of the Service</li>
                  <li className="text-base">Engages in data mining or similar data gathering practices</li>
                  <li className="text-base">Transmits any viruses, malware, or other harmful code</li>
                  <li className="text-base">Impersonates another person or entity</li>
                </ul>
              </section>

              <section className="mb-8">
                <h2 className="text-xl font-semibold mb-4">7. Termination</h2>
                <p className="text-base leading-relaxed mb-4">
                  We may terminate or suspend your account and access to the Service immediately, without prior notice or liability,
                  for any reason, including, without limitation, if you breach the Terms.
                </p>
                <p className="text-base leading-relaxed">
                  Upon termination, your right to use the Service will immediately cease. If you wish to terminate your account,
                  you may simply discontinue using the Service or contact us to request account deletion.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-xl font-semibold mb-4">8. Limitation of Liability</h2>
                <p className="text-base leading-relaxed mb-4">
                  In no event shall SyllaScan, its directors, employees, partners, agents, suppliers, or affiliates be liable for 
                  any indirect, incidental, special, consequential, or punitive damages, including without limitation, loss of profits, 
                  data, use, goodwill, or other intangible losses, resulting from:
                </p>
                <ul className="pl-6 list-disc space-y-2">
                  <li className="text-base">Your access to or use of or inability to access or use the Service</li>
                  <li className="text-base">Any conduct or content of any third party on the Service</li>
                  <li className="text-base">Any content obtained from the Service</li>
                  <li className="text-base">Unauthorized access, use, or alteration of your transmissions or content</li>
                </ul>
              </section>

              <section className="mb-8">
                <h2 className="text-xl font-semibold mb-4">9. Disclaimer</h2>
                <p className="text-base leading-relaxed">
                  Your use of the Service is at your sole risk. The Service is provided on an "AS IS" and "AS AVAILABLE" basis.
                  The Service is provided without warranties of any kind, whether express or implied, including, but not limited to,
                  implied warranties of merchantability, fitness for a particular purpose, non-infringement, or course of performance.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-xl font-semibold mb-4">10. Governing Law</h2>
                <p className="text-base leading-relaxed">
                  These Terms shall be governed and construed in accordance with the laws of the United States, without regard to its 
                  conflict of law provisions. Any disputes relating to these Terms shall be subject to the jurisdiction of the courts in 
                  the United States.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-xl font-semibold mb-4">11. Changes to Terms</h2>
                <p className="text-base leading-relaxed">
                  We reserve the right, at our sole discretion, to modify or replace these Terms at any time. We will provide notice of any 
                  changes by posting the new Terms on this page. You are advised to review these Terms periodically for any changes.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-xl font-semibold mb-4">12. Contact Us</h2>
                <p className="text-base leading-relaxed mb-4">
                  If you have any questions about these Terms, please contact us at:
                </p>
                <p className="text-base">terms@syllascan.com</p>
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