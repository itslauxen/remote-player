import './globals.css';

export const metadata = {
  title: 'Controle',
  applicationName: 'Controle',
  description: 'Controla e escolhe a musica que toca no PC.',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'Controle', statusBarStyle: 'black-translucent' },
  icons: { icon: '/icone-192.png', apple: '/icone-192.png' },
};

export const viewport = {
  themeColor: '#12131c',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
