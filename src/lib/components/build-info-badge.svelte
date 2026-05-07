<script lang="ts">
  import { base } from "$app/paths";

  interface DeployInfo {
    date: string;
    commit: string;
    commitFull: string;
    branch: string;
    repoUrl: string;
  }

  let info = $state<DeployInfo | null>(null);

  $effect(() => {
    fetch(`${base}/deploy.json`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data: DeployInfo) => {
        info = data;
      })
      .catch(() => {
        info = null;
      });
  });
</script>

{#if info}
  <span class="text-xs text-muted-foreground whitespace-nowrap">
    Deployed:
    <a
      href={`${info.repoUrl}/commit/${info.commitFull}`}
      target="_blank"
      rel="noopener noreferrer"
      class="underline hover:text-foreground">{info.commit}</a
    >
    · {info.date} · {info.branch}
  </span>
{/if}
