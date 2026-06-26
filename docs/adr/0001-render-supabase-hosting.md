# ADR 0001: Use Render and Supabase for the hosted demo

## Status

Accepted

## Context

The project needs a public demo that is easy to reproduce and inexpensive to operate. The app has a static Vue frontend, a Dockerized Express API, and a PostgreSQL + pgvector dependency.

## Decision

Deploy the Web app as a Render Static Site, deploy the API as a Render Docker Web Service, and continue using Supabase PostgreSQL + pgvector as the managed database.

## Consequences

- The hosted demo has two public origins: Web and API.
- The API must set CORS from `WEB_ORIGIN` and use `SameSite=None; Secure` cookies for hosted login.
- Supabase direct IPv6 connections can be incompatible with some hosted environments, so the deployment guide prefers Supabase Session Pooler URLs.
- Aiven is not needed while Supabase already provides the required PostgreSQL + pgvector role.

