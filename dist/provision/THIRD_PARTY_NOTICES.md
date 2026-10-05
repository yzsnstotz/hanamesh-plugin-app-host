# 分发与第三方记录

`@hanamesh/lib-provision` 0.1.0-rc.3 没有运行时依赖。tar / zip 读取、CRC32、sha256、HTTP 下载全部基于 Node.js 内置模块（`zlib`、`crypto`、`fs`、`fetch`）。

本记录按名称、版本、协议、来源、用途列明真实输入。自有代码的协议栏记录已有分发授权，不新增 SPDX 许可或再许可权利；原文见包内 `LICENSE`。

| 名称 | 版本 | 协议 / 依据 | 来源 | 用途 |
|---|---|---|---|---|
| @hanamesh/lib-provision | 0.1.0-rc.3 | HanaMesh 自有代码分发授权 D-2026-10-05-02（非 SPDX；未指定新许可） | https://github.com/yzsnstotz/hanamesh-lib-provision；输入 a4fe0b1c4a68b5018539ef4acaccf5f80674ba98 / rc.2 | Node 库与 hanamesh-provision CLI 的校验、解包、原子提升及账本 |
| @hanamesh/devkit | 0.1.0-rc.1 | HanaMesh 自有工具分发授权；旧归档仍记录 private=true / UNLICENSED，本卡保留原字节，不重标第三方或替换 vendor | hanamesh-server-shared；https://github.com/yzsnstotz/hanamesh-server-shared；b2b5c9bb7faa990e3eb9f99007abd6427d62e88b；vendor SHA256 3cf0b621ca2950fbe21c114d5b31ac1a55f97a67eb0a2dada77fb2d3bf2cb6ff | 仅开发工具 check / preflight / mutation / pack 验证；不随业务包分发 |
| typescript | 5.9.3 | Apache-2.0（安装包 LICENSE.txt 原文） | https://registry.npmjs.org/typescript/-/typescript-5.9.3.tgz | 构建 lib/ 与 .d.ts；不随包分发 |
| @types/node | 22.19.7 | MIT（安装包 LICENSE 原文） | https://registry.npmjs.org/@types/node/-/node-22.19.7.tgz | 类型声明；不随包分发 |
| undici-types | 6.21.0 | MIT（安装包 LICENSE 原文） | https://registry.npmjs.org/undici-types/-/undici-types-6.21.0.tgz | @types/node 的锁定传递类型依赖；不随包分发 |

开发依赖的第三方协议与锁定来源保留不变。devkit canonical 新元数据归 METADATA-DEVKIT-01；本 consumer 只有对应新字节独立 PASS 后才另卡更新。

测试 fixture 的自签证书（`tests/fixtures/fixture-cert.pem` / `fixture-key.pem`）由本仓生成，仅供本地 HTTPS fixture 使用，不随包分发。
