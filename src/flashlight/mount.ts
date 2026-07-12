export interface ComposerJson {
  name?: string;
  type?: string;
}

export interface Mount {
  containerPath: string;
  warning?: string;
}

export type MountMode = 'auto' | 'root' | 'modules' | 'themes';

export interface ResolveParams {
  composerJson: ComposerJson | null;
  workspaceBasename: string;
  mode: MountMode;
}

function nameFrom(cj: ComposerJson | null, fallback: string): string {
  if (cj?.name && cj.name.includes('/')) return cj.name.split('/').pop() as string;
  if (cj?.name) return cj.name;
  return fallback;
}

export function resolveMount(p: ResolveParams): Mount {
  if (p.mode === 'root') {
    return { containerPath: '/var/www/html' };
  }

  const name = nameFrom(p.composerJson, p.workspaceBasename);

  if (p.mode === 'modules') {
    return { containerPath: `/var/www/html/modules/${name}` };
  }
  if (p.mode === 'themes') {
    return { containerPath: `/var/www/html/themes/${name}` };
  }

  // mode === 'auto' — detect from composer.json type
  const type = p.composerJson?.type;
  if (type === 'prestashop-module') return { containerPath: `/var/www/html/modules/${name}` };
  if (type === 'prestashop-theme') return { containerPath: `/var/www/html/themes/${name}` };
  return {
    containerPath: `/var/www/html/modules/${p.workspaceBasename}`,
    warning: `composer.json missing or type unknown — defaulting to /var/www/html/modules/${p.workspaceBasename}. Set flashlight-mount to override.`,
  };
}
