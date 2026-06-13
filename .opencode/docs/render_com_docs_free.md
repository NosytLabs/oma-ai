# Deploy for Free – Render Docs

> Source: https://render.com/docs/free
> Cached: 2026-06-13T20:58:38.869Z

---

# Deploy for Free

## Preview the Render platform with free web services and datastores.

The **Hobby** [workspace plan](/pricing) is free, and supports up to 25 services. You can deploy certain Render service types **free of charge**:

- Web services (web apps in Node.js, Python, Rails, etc.)

- Render Postgres databases

- Render Key Value instances

**Free instances have important limitations. Do not use them for production applications.** However, they&#x27;re perfect for testing out a new technology, working on a hobby project, or previewing Render&#x27;s developer experience.

You can also deploy static sites on Render for free.

Web services and static sites count against your monthly included amounts of outbound bandwidth and pipeline minutes. View your usage in the [Render Dashboard](https://dashboard.render.com/billing#included-usage).

## [](#create-a-free-instance)Create a Free instance

For a more complete deployment walkthrough, see [**Your First Render Deploy**](/docs/your-first-deploy).

[Sign up for Render](https://dashboard.render.com/register) if you haven&#x27;t yet.

In the [Render Dashboard](https://dashboard.render.com), click **New**:

Select **Static Site**, **Web Service**, **Postgres**, or **Key Value**.

- Other service types don&#x27;t support Free instances.

During the service creation flow, you choose an **instance type** for your service (unless it&#x27;s a static site). Choose **Free**:

That&#x27;s it! When you finish creating and deploying your service, it runs on a Free instance.

For details on limitations of Free instance types, see the sections below.

## [](#free-web-services)Free web services

Free web services support many (but not all) features available to web services on paid instance types. Supported features include:

- [Custom domains](/docs/custom-domains)

- [Managed TLS certificates](/docs/tls)

- [Service previews](/docs/service-previews)

- [Log streams](/docs/log-streams)

- [Rollbacks](/docs/rollbacks) (only to the two most recent previous deploys)

**Most limitations below are specific to web services on the Free instance type.** To avoid these limitations, you can upgrade your service to any paid instance type.

### [](#spinning-down-on-idle)Spinning down on idle

Render **spins down** a Free web service that goes 15 minutes without receiving any inbound traffic. This includes both HTTP requests and WebSocket messages from existing connections.

A Free web service spins back *up* whenever it next receives an HTTP request or new WebSocket connection. This process takes about one minute. Render displays a loading page to connecting browsers while a service is spinning up.

Whenever a service spins down, any changes to its local filesystem are lost (see [Local files lost on redeploy](#local-files-lost-on-redeploy)).

### [](#local-files-lost-on-redeploy)Local files lost on redeploy

Like all Render services, Free web services have an [ephemeral filesystem](/docs/deploys#ephemeral-filesystem). This means that any changes to your web service&#x27;s filesystem (uploaded images, local SQLite databases, etc.) are *lost* every time the service redeploys, restarts, or [spins down](#spinning-down-on-idle).

**For long-term data storage:**

- *Paid* services can preserve local filesystem changes by attaching a [persistent disk](/docs/disks), but Free web services *cannot*.

Paid *and* Free services can persist relational data in a [Render Postgres](/docs/postgresql-creating-connecting) database.

- Note that Free Render Postgres databases [expire 30 days after creation](#30-day-limit).

### [](#monthly-usage-limits)Monthly usage limits

#### [](#free-instance-hours)Free instance hours

Render grants **750 Free instance hours** to each workspace per calendar month:

- A Free web service consumes these hours as long as it&#x27;s running ([spun-down services](#spinning-down-on-idle) don&#x27;t consume Free instance hours).

- If you consume all of your Free instance hours during a given month, Render **suspends** all of your Free web services until the start of the next month.

- At the start of each month, your Free instance hours reset to 750 (remaining hours don&#x27;t roll over).

#### [](#bandwidth-and-build-pipeline)Bandwidth and build pipeline

Free web services count against your monthly included amounts of outbound bandwidth and build pipeline minutes.

**If you consume all of your outbound bandwidth during a given month,** Render bills you for a supplementary amount.

- If you haven&#x27;t added a payment method, Render instead suspends all of your Free services for the remainder of the month.

**If you consume all of your build pipeline minutes during a given month,** Render bills you for a supplementary amount (unless you&#x27;ve reached your [spend limit](/docs/build-pipeline#setting-a-spend-limit).

- If you haven&#x27;t added a payment method or you reach your spend limit, Render instead disables all new builds for your workspace for the remainder of the month.

- In this case, your services remain active using their existing deploys.

#### [](#tracking-usage)Tracking usage

View your usage details from the **Monthly Included Usage** section of your [Billing page](https://dashboard.render.com/billing#included-usage) in the Render Dashboard:

Render notifies you via email when you’re approaching a usage limit, and then again if you exceed that limit.

### [](#service-initiated-traffic-threshold)Service-initiated traffic threshold

Render may suspend a Free web service that initiates an uncommonly high volume of traffic over the public internet.

Examples of service-initiated traffic include:

- Accessing an external database

- Invoking external APIs

- Transferring data to or from external object storage

If your service is suspended this way, you can restore it by moving it to any paid instance type.

### [](#automatic-robotstxt-responses)Automatic `robots.txt` responses

While a Free web service is [spun down](#spinning-down-on-idle), incoming requests to the path `/robots.txt` automatically receive a standard "disallow all" response:

These requests to do *not* reach your service or trigger a spin-up.

While a Free web service is active, requests to `/robots.txt` are routed to it as normal.

### [](#other-limitations)Other limitations

- Render might restart a Free web service at any time.

Free web services don&#x27;t support the following features of paid instance types:

- [Scaling](/docs/scaling) beyond a single instance

- Persistent disks

- [Edge caching](/docs/web-service-caching)

- Running [one-off jobs](/docs/one-off-jobs)

- [Shell access](/docs/ssh) via SSH or the Render Dashboard

Free web services can&#x27;t *receive* private network traffic.

- They can *send* private network requests to your data stores and paid services in the same region.

- Free web services can&#x27;t listen on reserved ports `18012`, `18013`, or `19099`.

- Free web services can&#x27;t send outbound network traffic on ports `25`, `465`, or `587`, commonly used for SMTP.

## [](#free-postgres)Free Postgres

**The limitations below are specific to Render Postgres databases on the Free instance type.** To avoid these limitations, you can upgrade your database to any paid instance type.

### [](#single-instance-limit)Single-instance limit

Only *one* Free Render Postgres database can be active for any given workspace.

### [](#1-gb-limit)1 GB limit

Free Render Postgres databases have a fixed storage capacity of 1 GB.

### [](#30-day-limit)30-day limit

**Free Render Postgres databases expire 30 days after creation.** An expired Free database is inaccessible unless you upgrade it to a paid instance type.

After a Free database expires, you have a grace period of 14 days to upgrade it to a paid instance type. After the grace period, Render **deletes** the database (along with all of its data).

Render notifies you via email when you’re approaching a Free database expiration, and then again when you&#x27;re approaching the end of the grace period.

### [](#other-limitations-1)Other limitations

- Render might perform maintenance on a Free Render Postgres database at any time. Your database is temporarily unavailable during maintenance.

- Render might restart a Free Render Postgres database at any time.

- Free Render Postgres databases don&#x27;t support any form of [backups](/docs/postgresql-backups).

## [](#free-key-value)Free Key Value

**The limitations below are specific to Render Key Value instances on the Free instance type.** To avoid these limits, you can upgrade your instance to any paid instance type.

### [](#single-instance-limit-1)Single-instance limit

Only *one* Free Key Value instance can be active for any given workspace.

### [](#in-memory-only)In-memory only

Unlike paid instances, Free Key Value instances do not continually persist their state to disk. This means that whenever an instance restarts, all of its data is lost.

### [](#other-limitations-2)Other limitations

- Render might perform maintenance on a Free Render Key Value instance at any time. Your instance is temporarily unavailable during maintenance.

- Render might restart a Free Render Key Value instance at any time (thereby [deleting its data](#in-memory-only)).

- If you upgrade a Free Render Key Value instance to a paid instance type, its data is lost during the upgrade process.

## [](#static-sites)Static sites

Static sites are free to deploy on Render. As with web services, they count against your monthly included amounts of outbound bandwidth and pipeline minutes. View your usage in the [Render Dashboard](https://dashboard.render.com/billing#included-usage).