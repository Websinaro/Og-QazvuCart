import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  serverExternalPackages: ['bcryptjs', 'pg'],
  reactStrictMode: true,
  turbopack: {},
  typescript: {
    ignoreBuildErrors: false,
  },
  // Allow access to remote image placeholder.
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
        port: '',
        pathname: '/**',
      },
    ],
  },
  output: 'standalone',
  transpilePackages: ['motion'],
  async rewrites() {
    return [
      // Firebase Cloud Messaging requires its service worker at a real,
      // root-scoped URL — browsers won't let a SW registered from /api/...
      // control the whole origin. The actual handler lives at the normal
      // app/api/firebase-messaging-sw/route.ts path; this just exposes it
      // at the path FCM/browsers expect.
      {
        source: '/firebase-messaging-sw.js',
        destination: '/api/firebase-messaging-sw',
      },
    ];
  },
  webpack: (config, {dev}) => {
    // HMR is disabled in AI Studio via DISABLE_HMR env var.
    // Do not modify—file watching is disabled to prevent flickering during agent edits.
    if (dev && process.env.DISABLE_HMR === 'true') {
      config.watchOptions = {
        ignored: /.*/,
      };
    }
    return config;
  },
};

export default nextConfig;
