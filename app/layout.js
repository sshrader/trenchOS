import './globals.css';

export const metadata = {
  title: 'TrencherOS',
  description: 'Classified intelligence for the trenches.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
