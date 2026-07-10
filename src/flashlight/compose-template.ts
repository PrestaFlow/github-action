export interface RenderParams {
  psVersion: string;
  port: number;
  workspace: string;
  containerPath: string;
}

export function renderCompose(p: RenderParams): string {
  return `services:
  prestashop:
    image: prestashop/prestashop-flashlight:${p.psVersion}
    ports:
      - "${p.port}:80"
    volumes:
      - ${p.workspace}:${p.containerPath}
    environment:
      PS_DOMAIN: localhost:${p.port}
      DEBUG_MODE: 0
      INIT_ON_RESTART: 0
`;
}
