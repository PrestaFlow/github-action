export interface ComposerJson {
  name?: string;
  type?: string;
}

export interface Mount {
  containerPath: string;
  warning?: string;
}

export interface ResolveParams {
  composerJson: ComposerJson | null;
  workspaceBasename: string;
}

function nameFrom(cj: ComposerJson | null, fallback: string): string {
  if (cj?.name && cj.name.includes('/')) return cj.name.split('/').pop() as string;
  if (cj?.name) return cj.name;
  return fallback;
}

export function resolveMount(p: ResolveParams): Mount {
  const type = p.composerJson?.type;
  const name = nameFrom(p.composerJson, p.workspaceBasename);
  if (type === 'prestashop-module') return { containerPath: `/var/www/html/modules/${name}` };
  if (type === 'prestashop-theme') return { containerPath: `/var/www/html/themes/${name}` };
  return {
    containerPath: `/var/www/html/modules/${p.workspaceBasename}`,
    warning: `composer.json missing or type unknown — defaulting to /var/www/html/modules/${p.workspaceBasename}`,
  };
}
