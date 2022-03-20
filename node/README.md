# hasura_starters - Node

This repo provides a starter project for creting an API with Hasura and Node.js.

It includes the following
- User authentication (with JWT tokens)
- User email verification and password resets (emails sent with Mailjet)
- Kubernetes friendly /readycheck and /healthcheck endpoints
- Graceful shutdowns (with terminus)
- Hasura actions and events configurations / controllers
- Backend job processing with BullMQ
- Arena UI for BullMQ

This project does not provide a user interface other than for user authentication workflows such as password resets.  It is intended for use as a backend for a Vue or React frontend.

Before using this project you'll want to search for the text "hasura_starters" and replace those strings with your app's name.

You must set the following environment variables before running the Node.js server:
- HASURA_GRAPHQL_ADMIN_SECRET
- JWT_SECRET
- ARENA_PASS

For development you can copy .env.example to .env.

This project runs postgres, hasura, and redis in docker containers.  The commands below include "--rm" so that they are easy to re-run. If you have problems with the container, remove the "--rm" so that you can use these commands to troubleshoot:

```
docker ps -a
docker logs <container id>
```

# Developing

You will need docker and nodejs (with yarn) installed on your machine.

**1) Start postgres and create database**

Create a directory on your machine for storing the postgres database.  Then, replace "~/Volumes/hasura_starters" in the command below with the path to your directory.

*Note, this uses postgres with postgis.  Replace "postgis/postgis" with "postgres" to use plain postgres.*

```
docker run --rm -d \
  --name local-postgres \
  -p 5432:5432 \
  -e POSTGRES_PASSWORD=pgadmin \
  -e PGDATA=/var/lib/postgresql/data/pgdata \
  -v ~/Volumes/hasura_starters:/var/lib/postgresql/data \
  postgis/postgis
```

On Windows:
```
docker run --rm -d `
  --name postgres `
  -p 5432:5432 `
  -e POSTGRES_PASSWORD=pgadmin `
  -e PGDATA=/var/lib/postgresql/data/pgdata `
  -v C:\Users\ablon\Volumes\hasura_starters:/var/lib/postgresql/data `
  postgis/postgis
```

Next connect to postgres and create a database:

```
psql -h localhost -U postgres
CREATE DATABASE hasura_starters;
\q
```

**2) Start hasura**

For mac or windows replace 172.17.0.1 with host.docker.internal

Note, HASURA_GRAPHQL_ENABLE_CONSOLE is set to false because you will need to run the hasura console from the cli in order to capture metadata and migrations as you create them.  **You must manually run the console for it to track your changes - see step 5 below!**

```
docker run --rm -d -p 8000:8000 \
  -e HASURA_GRAPHQL_SERVER_PORT=8000 \
  -e HASURA_GRAPHQL_DATABASE_URL=postgres://postgres:pgadmin@172.17.0.1:5432/hasura_starters \
  -e HASURA_GRAPHQL_ENABLE_CONSOLE=false \
  -e HASURA_GRAPHQL_ADMIN_SECRET=mydevsecret \
  -e HASURA_GRAPHQL_AUTH_HOOK=http://172.17.0.1:3000/hasura/auth \
  -e ACTIONS_BASE_URL=http://172.17.0.1:3000/hasura/actions \
  -e EVENTS_WEBHOOK_URL=http://172.17.0.1:3000/hasura/events \
  -e HASURA_GRAPHQL_CORS_DOMAIN=* \
  hasura/graphql-engine:latest
```

On Windows:
```
docker run --rm -d -p 8000:8000 `
  -e HASURA_GRAPHQL_SERVER_PORT=8000 `
  -e HASURA_GRAPHQL_DATABASE_URL=postgres://postgres:pgadmin@host.docker.internal:5432/hasura_starters `
  -e HASURA_GRAPHQL_ENABLE_CONSOLE=false `
  -e HASURA_GRAPHQL_ADMIN_SECRET=mydevsecret `
  -e HASURA_GRAPHQL_AUTH_HOOK=http://host.docker.internal:3000/hasura/auth `
  -e ACTIONS_BASE_URL=http://host.docker.internal:3000/hasura/actions `
  -e EVENTS_WEBHOOK_URL=http://host.docker.internal:3000/hasura/events `
  -e HASURA_GRAPHQL_CORS_DOMAIN=* `
  hasura/graphql-engine:latest
```

**3) Start redis**

```
docker run --rm --name local-redis -p 6379:6379 -d redis
```

**4) Start the Node.js server**

This project has only been tested on node 14 and 16.

```
cd node
nvm use 16
yarn install
yarn dev
```

**5) start hasura console**

The hasura cli was installed via yarn with the commands above.  You may want to [install the cli globally](https://hasura.io/docs/latest/graphql/core/hasura-cli/install-hasura-cli.html).


Run these commands once to bootstrap the database and hasura metadata:

```
cd node
export HASURA_GRAPHQL_ADMIN_SECRET=mydevsecret
yarn hasura migrate apply --project ../hasura
yarn hasura metadata apply --project ../hasura
```

Then run the console for day to day development:

``` Console Startup
cd node
export HASURA_GRAPHQL_ADMIN_SECRET=mydevsecret
yarn hasura console --project ../hasura
```

On windows:

```Windows
cd node
$env:HASURA_GRAPHQL_ADMIN_SECRET = 'mydevsecret'
yarn hasura console --project ../hasura
```

Note, If developing in a container or on a remote host you will likely want to have VSCode forward ports : 3000, 8000, 9695, 9693

## GraphQL examples

Try these queries in the Hasura console.  You'll want to un-check the "x-hasura-admin-secret" header to act like a normal user:

![Hasura Console Example](./docs/hasura_console_as_user.jpg)

To execute queries from your frontend app, I recommend using a combo of [graphql-request](https://www.npmjs.com/package/graphql-request) and [graphql-ws](https://www.npmjs.com/package/graphql-ws).  I strongly suggest you avoid using the apollo graphql client as I found it extraordinarly overengineered and frustrating to use.  A NuxtJS plugin for using the packages above can be found in the repo at [./docs/graphql.js](./docs/graphql.js).

Register
```
mutation Register {
  register(email: "somebody@example.com", password: "secret") {
    id
    token
  }
}
```

Login
```
mutation Login {
  login(email: "somebody@example.com", password: "secret") {
    token
  }
}
```

**To logout, simply throw away token.**

Determine id of current user (requires Authorization header)
```
query Whoami {
  whoami {
    id
  }
}
```

Change password (requires Authorization header)
```
mutation Changepass {
  changePassword(new_password: "supersecret", old_password: "secret") {
    password_at
  }
}
```

Request password reset
```
mutation RequestPasswordReset {
  resetPassword(email: "somebody@example.com") {
    success
  }
}
```

## Actions

This project has a controller setup for custom actions.  If you need to create custom endpoints for your API create them with an action instead of adding routes to express.  Learn more about actions [here](https://hasura.io/docs/latest/graphql/core/actions/index.html).

## Events

This project has a controller setup for custom events.  You'll most likely want to hand hasura events off to BullMQ for actual processing.  See the jobs folder for examples.  Learn more about events [here](https://hasura.io/docs/latest/graphql/core/event-triggers/index.html).

## Deploying on hasura.io

Set these env vars in your hasura.io console to use a running instance of this node.js server (see examples in docker command in step 2 above):
- HASURA_GRAPHQL_AUTH_HOOK
- ACTIONS_BASE_URL
- EVENTS_WEBHOOK_URL

Here is an example of setting HASURA_GRAPHQL_AUTH_HOOK in the hasura.io dashboard:

![Hasura Env Var Example](./docs/hasura_io_env_var.jpg)

Set these env var for the node.js environment to point it at your hasura.io 
instance:
- HASURA_GRAPHQL_ADMIN_SECRET = *Found under "Admin Secret" in dashboard*
- HASURA_BASE_URL = *Something like https://blah-blah-78.hasura.app*
