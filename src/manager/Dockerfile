# ======= FRONTEND BUILD ==========
FROM node:20-alpine AS frontend-build

# Install pnpm and make
RUN npm install -g pnpm@9.4.0
RUN apk add --no-cache make

WORKDIR /app

# Copy the frontend source code
COPY ./frontend ./frontend
COPY ./Makefile .

RUN make build-frontend

# ======= BACKEND BUILD ==========
# Prepare the requirements stage
FROM python:3.11 AS requirements-stage
WORKDIR /tmp
RUN pip install poetry==1.7.1
COPY ./pyproject.toml ./poetry.lock* /tmp/
RUN poetry export --output requirements.txt --without-hashes

# ======= RELEASE ==========
FROM python:3.11

WORKDIR /app
ENV PYTHONPATH=/app

COPY --from=requirements-stage /tmp/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir --upgrade -r /app/requirements.txt

COPY --from=frontend-build /app/frontend/out /app/static

COPY . /app

ENTRYPOINT ["/app/entrypoint.sh"]

CMD ["fastapi", "run", "main.py"]