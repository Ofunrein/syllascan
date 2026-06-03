/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  serverExternalPackages: ['pdf-parse', 'pdfjs-dist'],
  typescript: {
    // !! WARN !!
    // Dangerously allow production builds to successfully complete even if
    // your project has type errors.
    // !! WARN !!
    ignoreBuildErrors: true,
  },
  eslint: {
    // Disabling eslint during build for deployment
    ignoreDuringBuilds: true,
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Don't resolve 'fs', 'child_process', etc. on the client
      config.resolve.fallback = {
        fs: false,
        child_process: false,
        http2: false,
        net: false,
        tls: false,
        dns: false,
        os: false,
        path: false,
        stream: false,
        crypto: false,
      };
    } else {
      // Prevent the pdfjs-dist worker from being bundled into the server chunk.
      // The worker is browser-only; on the server we use pdf-parse instead.
      config.externals = [
        ...(Array.isArray(config.externals) ? config.externals : [config.externals].filter(Boolean)),
        ({ request }, callback) => {
          if (request && request.includes('pdf.worker')) return callback(null, 'commonjs ' + request);
          callback();
        },
      ];
    }
    return config;
  },
  // Add this to suppress hydration warnings in development
  onDemandEntries: {
    // period (in ms) where the server will keep pages in the buffer
    maxInactiveAge: 25 * 1000,
    // number of pages that should be kept simultaneously without being disposed
    pagesBufferLength: 2,
  },
};

module.exports = nextConfig; 