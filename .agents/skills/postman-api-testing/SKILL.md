---
name: postman-api-testing
description: Skill to use Postman tools and MCP server for API testing, collection runs, and documentation.
---

# Postman API Testing Skill

Instructions for performing API testing and documentation using Postman and its integrations.

## 1. Run Collections
- Use the Postman MCP Server if available: `npx @postman/postman-mcp-server --full`.
- Use the `runCollection` tool from the MCP server to execute API tests with a specific `collectionId` and `environmentId`.
- Validate that tests cover both success (200/201) and error (4xx/5xx) paths.
- Ensure that sensitive data is parameterized using `{{variable}}` instead of hardcoded strings.

## 2. Update Documentation
- Ensure all endpoints have descriptions in the collection.
- Add or update requests to accurately reflect the Supabase backend's current schema.
- Use the MCP server's workspace management tools to synchronize documentation.

## 3. Mock Servers
- When the backend is incomplete, set up Postman mock servers using the collection definitions so that React Native developers can continue building the UI.
