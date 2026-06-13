# Cron Jobs – Render Docs

> Source: https://render.com/docs/cronjobs
> Cached: 2026-06-13T20:58:47.677Z

---

# Cron Jobs

## Run periodic tasks on a schedule you define.

You can create [cron jobs](https://en.wikipedia.org/wiki/Cron) on Render that run periodically on a schedule you define. You create cron jobs in the [Render Dashboard](https://dashboard.render.com/cron/new), just like you create any other service type:

Your cron job can use any of your [GitHub](/docs/github)/[GitLab](/docs/gitlab)/[Bitbucket](/docs/bitbucket) repos, or it can pull a [prebuilt Docker image](/docs/deploying-an-image) from an external registry.

- **If you connect a Git repo,** Render builds a new version of your code whenever you push changes to your connected branch. The new build does not affect in-progress runs (only future runs).

- **If you pull a Docker image,** Render pulls that image before *each run* of your cron job. Render does not retain pulled images between runs.

Cron jobs can&#x27;t provision or access a [persistent disk](/docs/disks#disk-limitations-and-considerations).

## [](#setup)Setup

The cron job setup flow is similar to that of other service types, but with a couple of fields specific to cron jobs:

FieldDescription
**Schedule**

The schedule to use for the cron job, defined as a [cron expression](https://en.wikipedia.org/wiki/Cron#CRON_expression).

Here are some examples:

- **Every ten minutes:** `*/10 * * * *`

- **Once every day at noon UTC:** `0 12 * * *`

- **Once every 60 minutes, Monday through Friday UTC:** `*/60 * * * MON-FRI`

All day and time ranges use UTC.

**Command**

The command to execute with each run. This can be:

- Any valid Linux command, such as `echo "Hello!"`

- An executable [bash script](https://tldp.org/LDP/Bash-Beginners-Guide/html/sect_02_01.html) that contains the command(s) to run

**Make sure to use a command that exits when it&#x27;s done!** Like other service types, cron jobs are billed according to how long they run.

**This field is not present for Docker-based cron jobs.**

Instead, Render defaults to running your Docker image&#x27;s startup command (as defined by `ENTRYPOINT` and/or `CMD` in your Dockerfile).

You can override this by setting a custom **Docker Command** under **Advanced** in the creation flow.

### [](#environment-variables)Environment variables

Like any other Render service, cron jobs can set [environment variables](/docs/configure-environment-variables) for values like database URLs and API keys. You can also share environment variables across multiple services with an [environment group](/docs/configure-environment-variables#environment-groups).

## [](#manually-triggering-a-run)Manually triggering a run

To run your cron job at an unscheduled time (such as for debugging purposes), go to its page in the [Render Dashboard](https://dashboard.render.com) and click **Trigger Run**.

If you manually trigger a cron job run while *another* run is active, Render first *cancels* the active run. For details, see [Single-run guarantee](#single-run-guarantee).

## [](#single-run-guarantee)Single-run guarantee

**Render guarantees that at most one run of a given cron job is active at a given time.** This protects against issues that can arise with parallel execution.

###### [](#what-if-i-manually-trigger-a-run-while-another-run-is-active)What if I manually trigger a run while another run is active?

Render immediately cancels the active run, then starts the manually triggered run.

###### [](#what-if-a-run-is-currently-active-at-the-time-of-the-next-scheduled-run)What if a run is currently active at the time of the next scheduled run?

Render *delays* the next scheduled run until the active run finishes.

###### [](#what-if-my-run-never-finishes-or-takes-a-very-long-time)What if my run never finishes or takes a very long time?

Render stops an active run after 12 hours. To perform tasks that run longer than this (or continuously), instead create a [workflow](/docs/workflows) or [background worker](/docs/background-workers).

## [](#instance-types-and-billing)Instance types and billing

Cron jobs can use whichever [instance type](/pricing#cron-jobs) best suits their CPU and memory requirements. Billing is prorated by the second, based on active running time during a given month.

There is a minimum monthly charge of $1 per cron job service.