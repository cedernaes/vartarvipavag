Build the container

```bash
docker build --tag vartarvipavag-server .
```

Run locally

```bash
docker run -p 3001:3001 \
--volume $(pwd)/../data:/data vartarvipavag-server:latest
```

Run locally with password authentication

```bash
docker run -p 3001:3001 \
-e CLIENT_PASSWORD=test123 \
--volume $(pwd)/../data:/data vartarvipavag-server:latest
```

Run with both client and admin passwords (admin password enables deleting positions from local network)

```bash
docker run -p 3001:3001 \
-e CLIENT_PASSWORD=test123 \
-e ADMIN_PASSWORD=admin123 \
--volume $(pwd)/../data:/data vartarvipavag-server:latest
```

Then you can reach the container on http://localhost:3001/health
