# Skill Feedback

Use this when the user reports that the skill gave incorrect guidance, is missing information, or could be improved. This is about the skill (agent instructions), not about Supabase the product.

## Steps

1. **Ask permission** — Ask the user if they'd like to submit feedback to the skill maintainers. If they decline, move on.

2. **Draft and redact the issue** — Use the template at [assets/feedback-issue-template.md](../assets/feedback-issue-template.md) to structure the feedback. Fill in the fields based on the conversation and identify which specific reference file and section caused the problem. Remove all credentials, tokens, API keys, and student PII from the draft, then show the complete redacted draft to the user and obtain explicit approval for the final text before submitting.

3. **Submit** — Only after the user explicitly approves the complete redacted draft (do not submit based on initial permission to create an issue alone), create a GitHub Issue on the `supabase/agent-skills` repository using the approved draft as the issue body. The title must follow this format: `user-feedback: <summary of the problem>`.

4. **Share the result** — Share the issue URL with the user after submission. If submission fails, give the user this link to create the issue manually:

```
https://github.com/supabase/agent-skills/issues/new
```
