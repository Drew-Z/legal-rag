# Resume Snippets

这些描述可以用于简历、GitHub profile、作品集页面或面试自我介绍。不要把登录密码、模型 key 或数据库连接串放进公开材料。

## 中文简历版

**Legal RAG 法律智能机器人与合同审查系统**

基于 Vue 3、TypeScript、Express、Supabase PostgreSQL + pgvector 和 OpenAI-compatible 模型构建并部署法律文档 RAG 应用；支持 Render 线上演示、配置型登录门禁、项目空间授权、公开安全数据集初始化、TXT/PDF/DOCX 上传、条款级 chunk、真实 embedding、混合召回、轻量 rerank、引用溯源、资料不足拒答、合同风险审查和质量评测面板。通过 provider adapter 与 vector store adapter 保留 mock 本地演示和 pgvector 生产持久化两种运行形态，CI 覆盖 typecheck、单元测试、RAG eval、合同审查 eval、build 和 Docker Compose 配置检查。

## English Resume Version

**Legal RAG Assistant and Contract Review System**

Built and deployed a full-stack legal-document RAG application with Vue 3, TypeScript, Express, Supabase PostgreSQL + pgvector, and OpenAI-compatible model gateways. The system supports a hosted Render demo, configured-user login, project-space authorization, public-safe dataset seeding, TXT/PDF/DOCX ingestion, section-aware chunking, real embeddings, hybrid retrieval, lightweight reranking, citation-grounded answers, refusal handling, rule-guided contract risk review, and a quality dashboard. Designed provider and vector-store adapters so the same codebase can run locally with mock/memory mode or in production with pgvector persistence. CI covers type checking, unit tests, deterministic RAG evaluation, contract-review evaluation, build, and Docker Compose validation.

## Short Portfolio Summary

Legal RAG is a deployed full-stack AI project that turns legal and contract documents into a searchable, citation-grounded knowledge base. It demonstrates the full RAG loop from ingestion to evaluation: parsing, dedupe, chunking, embeddings, pgvector persistence, hybrid retrieval, reranking, answer generation, citations, refusal behavior, contract risk review, and quality reporting.

## Interview One-Liner

我做的不是简单聊天壳，而是一个完整上线的法律 RAG 工程闭环：文档入库、chunk、embedding、pgvector、混合召回、rerank、引用溯源、拒答评测和合同审查评测都有可运行实现。
