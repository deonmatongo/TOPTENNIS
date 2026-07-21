import React from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const UPDATED = '21 July 2026';

const SECTIONS: { title: string; body: string[] }[] = [
  {
    title: 'Who we are',
    body: [
      'This Privacy Policy explains how Top Tennis ("we", "us", "our") collects, uses and protects your personal information when you use the Top Tennis apps and services (the "Service"). It applies to players in Zimbabwe, Poland and anywhere else the Service is available.',
    ],
  },
  {
    title: 'Information we collect',
    body: [
      'Account & profile: your name, email address, phone number, city/location, skill level, rating and profile photo.',
      'Tennis activity: matches, scores, league and division participation, availability, court bookings and achievements.',
      'Messages & support: messages you send to other players and to our support team, including via WhatsApp.',
      'Device & usage: app version, device type, basic diagnostics and crash reports, and notification tokens.',
      'We only collect what we need to run the Service.',
    ],
  },
  {
    title: 'How we use your information',
    body: [
      'To provide the Service (accounts, matches, leagues, standings, bookings, messaging); to match you with suitable opponents and leagues; to send notifications you have enabled; to provide customer support; to keep the Service secure and prevent abuse; and to improve features using aggregated, non-identifying insights.',
    ],
  },
  {
    title: 'Legal bases for processing',
    body: [
      'Where the EU/EEA General Data Protection Regulation (GDPR) applies (for example, for players in Poland), we rely on: performing our contract with you; your consent (for optional notifications and marketing); our legitimate interests (to secure and improve the Service); and compliance with legal obligations.',
      'You can withdraw consent at any time, for example by turning off notification categories in Settings.',
    ],
  },
  {
    title: 'How we share information',
    body: [
      'With other players, according to your privacy settings (public, friends-only or private).',
      'With service providers who process data on our behalf under contract, including Supabase (database, auth, storage), Twilio (WhatsApp support), Anthropic (support assistant), Sentry (diagnostics) and LiveKit (in-app calling, where used).',
      'We do not sell your personal information. We may disclose information if required by law or to protect the rights and safety of our users.',
    ],
  },
  {
    title: 'Data storage and security',
    body: [
      'Your data is stored on secured cloud infrastructure with access controls, encryption in transit, and regular backups. While no system is perfectly secure, we take reasonable technical and organisational measures to protect your information.',
    ],
  },
  {
    title: 'Data retention',
    body: [
      'We keep your information for as long as your account is active or as needed to provide the Service. When you delete your account, we delete or anonymise your personal data within a reasonable period, except where we must retain records to meet legal, accounting or dispute-resolution obligations.',
    ],
  },
  {
    title: 'Your rights',
    body: [
      'Depending on where you live, you may have the right to access, correct, delete, export, object to or restrict processing of your personal data, and to withdraw consent.',
      'You can exercise many of these directly in the app (edit your profile, adjust Privacy settings, or delete your account). For any request, contact support@toptennis.app and we will respond within the time required by law.',
    ],
  },
  {
    title: 'Notifications and messaging',
    body: [
      'If you enable push or email notifications, we use your device token and contact details to send them. You control notification categories in Settings and can turn them off at any time.',
      'If you contact support over WhatsApp, your messages are processed by Twilio and may be reviewed by our support assistant and team to resolve your query.',
    ],
  },
  {
    title: 'Children’s privacy',
    body: [
      'The Service is not intended for children under 16 (or the age of digital consent in your country). We do not knowingly collect data from children below that age. If you believe a child has provided us data, contact us and we will remove it.',
    ],
  },
  {
    title: 'International transfers',
    body: [
      'Your information may be processed in countries other than where you live, including where our service providers operate. Where required, we use appropriate safeguards (such as standard contractual clauses) to protect data transferred across borders.',
    ],
  },
  {
    title: 'Changes to this policy',
    body: [
      'We may update this Privacy Policy from time to time. If we make material changes, we will notify you in the app or by other reasonable means. The "Last updated" date above shows when it last changed.',
    ],
  },
  {
    title: 'Contact us',
    body: [
      'For any privacy question or request, email support@toptennis.app. If you are in the EU/EEA and are not satisfied with our response, you may also lodge a complaint with your local data-protection authority.',
    ],
  },
];

const Privacy = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 pt-24 sm:pt-28 lg:pt-32 pb-8 sm:pb-12 lg:pb-16">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8 sm:mb-12">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground mb-3 sm:mb-4">Privacy Policy</h1>
            <p className="text-base sm:text-lg text-muted-foreground">Last updated {UPDATED}</p>
          </div>
          <div className="space-y-4 sm:space-y-6">
            {SECTIONS.map((sec, i) => (
              <Card key={sec.title} className="shadow-sm hover:shadow-md transition-shadow duration-200">
                <CardHeader className="pb-3 sm:pb-4">
                  <CardTitle className="text-lg sm:text-xl lg:text-2xl text-primary">{`${i + 1}. ${sec.title}`}</CardTitle>
                </CardHeader>
                <CardContent className="pt-0 space-y-3">
                  {sec.body.map((p, j) => (
                    <p key={j} className="text-sm sm:text-base lg:text-lg text-foreground leading-relaxed">{p}</p>
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Privacy;
