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
    depends_on:
      mysql:
        condition: service_healthy
    ports:
      - "${p.port}:80"
    volumes:
      - ${p.workspace}:${p.containerPath}
    environment:
      PS_DOMAIN: localhost:${p.port}
      DEBUG_MODE: 0
      INIT_ON_RESTART: 0

  mysql:
    image: mariadb:lts
    healthcheck:
      test: ["CMD", "healthcheck.sh", "--connect"]
      interval: 10s
      timeout: 10s
      retries: 5
    environment:
      MYSQL_USER: prestashop
      MYSQL_PASSWORD: prestashop
      MYSQL_ROOT_PASSWORD: prestashop
      MYSQL_DATABASE: prestashop
`;
}
