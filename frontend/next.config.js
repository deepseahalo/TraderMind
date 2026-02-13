/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // 禁用 SWC，使用 Babel 作为替代（解决 SWC 二进制文件问题）
  swcMinify: false,
  // 如果 SWC 仍然有问题，可以尝试这个配置
  experimental: {
    // 强制使用 JavaScript 编译器而不是 SWC
  }
}

module.exports = nextConfig
