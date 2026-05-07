# Quasar dev container — Phase A
# Single Node base, Quasar CLI installed globally, runs `quasar dev` against
# the mounted source. Port 9000 is exposed for HMR and HTTP.

FROM node:20-alpine

# git is required by some quasar plugins; bash for nicer entrypoint behaviour.
RUN apk add --no-cache git bash

# Install Quasar CLI v2 globally (matches the app's @quasar/cli version).
RUN npm install -g @quasar/cli@2.4.1

WORKDIR /app

# We mount the fork at /app at runtime, so we don't COPY anything here.
# package.json/lock are installed at first boot via the entrypoint to keep
# the image small and let lockfile changes flow through volume mount.

EXPOSE 9000

ENV NODE_ENV=development

# Entrypoint: install deps if node_modules is missing, then run dev server.
COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["quasar", "dev"]
