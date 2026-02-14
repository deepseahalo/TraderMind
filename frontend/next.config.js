/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: false,
  experimental: {},
  // 公网部署时：API 走同源，由 Next 转发到后端，只需暴露一个端口
  async rewrites() {
    return [
      { source: "/api/:path*", destination: "http://127.0.0.1:8080/api/:path*" },
    ];
  },
};

module.exports = nextConfig;
