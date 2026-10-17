# Restoring daily question imports

The block is at **krillionanswers.com**, the independent answers companion. It is not a missing GitHub permission, Render setting or Krillion account login. The first GitHub-hosted run received HTTP 403 Forbidden while fetching the public answer-finder page. The same importer succeeded from this workspace. This establishes a difference in permitted access, not its exact cause; the source owner must advise whether it is a security rule or an intentional automated-access restriction.

The owner's [contact page](https://krillionanswers.com/contact/) lists **hello@krillionanswers.com**. Ask for permission to reuse the recorded lists and an approved API/feed or access method for one daily automated batch. Do not send GitHub credentials or account passwords. Hosted GitHub runners do not have a single stable outbound address, so asking to allow one observed IP is not a reliable setup.

Suggested message, ready to send yourself:

> Subject: Permission for a daily question-data import into Counterline
>
> Hi, I run Counterline, a small independent quiz for friends at https://flat-dive.onrender.com. Would you permit us to reuse your publicly recorded question/answer lists and tiers, with attribution and links to your site?
>
> We would like one automated import batch per day from GitHub Actions. Our initial runner received HTTP 403 from the answer-finder page. The current importer makes roughly 90 sequential requests per daily batch; we are happy to follow your limits or use a supported feed instead. Is there an approved API, downloadable dataset, or access arrangement you would recommend? Please also let us know your reuse and attribution conditions.
>
> Thanks.

No message has been sent by Codex. A reply with approved reuse/access instructions is needed; then the importer can be adapted, the manual workflow verified and the commented daily schedule enabled. Any key belongs in GitHub Actions secrets, not committed code. A successful import must also deploy to Render before the live bank changes. Meanwhile the existing 200-question bank works independently and original sourced questions can still be added without this integration.
