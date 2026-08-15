import './globals.css';

export const metadata = {
  title: 'Controle',
  applicationName: 'Controle',
  description: 'Controla e escolhe a musica que toca no PC.',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'Controle', statusBarStyle: 'black-translucent' },
  // O capable virou a meta sem prefixo no Next 16, e o iOS so entende ela do
  // 17.4 para cima. Antes disso, sem a antiga, o app da tela de inicio nao abre
  // em tela cheia - e ai a barra de inicio vira uma faixa fora da web view, com
  // a cor que o sistema escolher.
  other: { 'apple-mobile-web-app-capable': 'yes' },
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon-16.png', sizes: '16x16', type: 'image/png' },
    ],
    apple: '/apple-touch-icon-180.png',
  },
};

export const viewport = {
  themeColor: '#07080c',
  width: 'device-width',
  initialScale: 1,
  // Sem zoom: o iOS aproxima ao focar o campo de busca e nao desfaz depois.
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
