# Auth API Challenge

## Table of Contents
1. [Getting Started](#getting-started)
2. [Design Decisions](#design-decisions)
3. [Future Development](#future-development)
4. [Approaching this challenge](#approaching-this-challenge)

## Getting Started

### Prerequisites

Before running the application, ensure the following are installed:
- Node.js
- npm
- Docker Desktop with Docker Compose

#### Environment Variables
```
#Copy this file to .env and fill in the values for your environment
REDIS_PASSWORD=please-enter-a-secure-password-here
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
```

#### Setup

Ensure that Docker Desktop is running before continuing.

These commands will help the rest of setup:
```
# Copy '.env.example' to '.env' and enter a password for Redis
# Optional if not already copied from above
cp .env.example .env

# Install dependencies
npm install

# Start Redis in Docker, but only after Docker Desktop is running
Docker compose up -d

# Launch the API
npm run dev
```

### Health Checks:
#### Check Docker Container is running and is Healthy
```
docker compose ps
```
Expected response:
- Under 'STATUS' should say (healthy)

#### Check Redis connection

```
# curl
curl http://127.0.0.1:3000/health

# Windows PowerShell
Invoke-RestMethod http://127.0.0.1:3000/health
```

Expected Response:
```
{ "status": "ok", "redis": "PONG" }
```

### Create User
Send a `POST` request to `/users` with valid username and password:

#### curl
```Bash
curl -X POST http://127.0.0.1:3000/users \
  -H "Content-Type: application/json" \
  -d '{
    "username": "example-user",
    "password": "example password ipsum lorem"
  }'
```

#### Windows PowerShell
```ps
$body = @{
    username = "example-user"
    password = "example password ipsum lorem"
} | ConvertTo-Json

Invoke-RestMethod `
    -Method Post `
    -Uri http://127.0.0.1:3000/users `
    -ContentType "application/json" `
    -Body $body
```

#### Successful Response:
`200`
```JSON
{ 
    "username": "example-user",
    "createdAt": "2026-08-03T15:00:00.000Z"
}
```
#### Submit again to experience the username conflict response:
`409`
```JSON
{
    "error": "Username already exists." 
}
```

### Stopping the Application

#### Stop the Node.js + Fastify dev server:
Use the `Ctrl + C` command

#### Stop the Redis Container:
Run `docker compose down`

## Design Decisions

### Username Requirements

Usernames have to meet the following requirements:
- 3 to 18 characters
- contains only letters, numbers, periods, underscores, or hyphens
- treated as case-insensitive

The username is treated as case-insensitive and is set to lowercase before being used as the Redis key. 
`user:<lowercase-username>
Example: Mohammed is stored as user:mohammed.

The min length of 3 characters prevents extremely short usernames but still supports names.

The max length of 18 characters is a design choice to keep usernames concise and readable. This could be increased if needed but I chose it arbitrarily. My full name as a username could be Mohammed_Elsaadi which is 16 characters. 18 Would allow a middle initial to be included.

I restricted the characters of the username to not allow spaces or colons to avoid ambiguous usernames that would otherwise blend in as multiple phrases in a sentence. Also it would help differentiate from the Redis key namespace such as `user:mohammed`.

Although there is no visual aspect to this challenge, it is a design decision I would make for my user base. This also helps for clarity when reading logs.


### Password Requirements
Passwords must meet these requirements:
- Between 15 to 128 characters
- Allowed to make use of spaces
- Do not require any specific combination of characters or symbols
- May not be in the blocked passwords
- May not contain the username if the username is 5+ characters
- May not be the username

The use of spaces allowed and lack of special characters being enforced may seem like a strange decision but it is actually a recommendation by NIST [as sourced here](https://pages.nist.gov/800-63-4/sp800-63b/passwords/) and explained by ['Ask Leo!' on youtube](https://www.youtube.com/watch?v=ICLyekTM2wU). Both are also linked in the references section below.

Allowing spaces supports long passphrases, which can be easier to remember than shorter strings of arbitrary characters. Password strength comes mainly from length and unpredictability. Not necessarily from simply adding a special character.

Users tend to be very predictable with special characters and numbers, leaving them to be placed at the end. Capital letters tend to always be the first character. Example: `Baseball123!`

However people tend to still follow predictable trends, so I added a block list for common passwords to prevent users from having well known common passwords. The list is not extensive for the scope of this challenge, but in production I would use the 'Have I been Pwned' Password check API that allows you to use the first 5 characters of the password's SHA-1 hash to see how many passwords exist in the list prefixed by this password.

I also added a safeguard to block passwords that are equal to, or contain the username if it is 5+ characters long. This prevents the cases where a small username like 'sam' is small enough to be part of many words in the password. 

## Future Development
Topics that I would tackle in the future to enhance the security of this API.

- ### HaveIBeenPwned Password Blocklist
    [This API](https://haveibeenpwned.com/Passwords) can return the list passwords that suffix the 5 character prefix of the proposed password's SHA-1 hash. From there the server can check the list for the full SHA-1 value to check if the password exists in the 'pwned' database. If it exists then it should block the password from being created. SHA-1 would only be used for the lookup, but Argon2id is still the hash algorithm for storage.

- ### Rate Limiting for creation / authentication endpoints
- ### Avoiding passwords and password hashes in logs
- ### Request body size limits
- ### 

## Approaching This Challenge
### Introduction
This document captures my initial understanding of the assignment, the questions that came to mind before implementing, and the reasoning behind my eventual implementation decisions.

I am writing it before beginning development so the repository showcases how my approach evolves and will provide insight to my thought process. My goal is to show how I approach unfamiliar tasks and how I research, learn, and make informed decisions.

### Initial Thoughts and Research
#### Initial takeaways
- The service requires two endpoints: one for user creation and one to authenticate users
- The service runs on Node.js
- Uses Redis as the data storage
- Usernames must be unique
- The API must use REST and JSON
- Successful request returns 200 OK and failed authentication returns 401 Unauthorized
- Error responses use JSON response bodies
- Passwords require secure validation and storage
- Service must be fast and secure
- Need to implement testing for different cases (usernames, password, security, etc)
- Any other security checks outside my assignment scope to be documented

#### Redis as data storage

Redis was less familiar to me than relational databases. I had looked into it before as a caching solution but not used it as the primary data storage.

I used ChatGPT as a research tool to quickly understand relevant concepts such as Redis hosting for Docker, connecting with Node.js clients, read/write commands, and existence checks. I verified with online Redis documentation as well.

I learned that the write command has a flag NX which returns OK (did not exist) or NULL (exists). I can have the Node API return 200 or 409 based on Redis returning OK/NULL.

Asking why to use NX instead of checking EXISTS first confirmed what I expected, Using SET with the NX flag avoids the race condition that could occur if existence check and set action were performed as separate operations.

If two requests came in at the same time for the same username, using NX with SET would only allow one request to create the username and correctly provide username is unavailable to the other request.

I will be storing key-value pairs using the lowercase form of the username as the key and JSON as the value to keep user records.

#### Password Securitity

Having worked with credential storage previously, I know passwords should never be stored in plaintext or encrypted in a way where a key can decrpt it. By hashing with Argon2id I can ensure a one way conversion that cannot be undone to retrieve the original password.

I plan to enforce min and max character limits, and allow special characters for complexity. I also will create a block list of common passwords like password123!

For the password storage I will use Argon2id over bcrypt as it is the best rated password hashing algorithm by OWASP.

#### Framework Decision

My previous Node.js experience was with Next.js where backend endpoints were part of a larger React application. This assignment does not require a front end or server side rendering.

I researched and compared frameworks for Node.js and landed on Fastify as it provides schema-based request validations and response serialization which feels like a clean system that aligns with my .NET experience with ASP.NET requests and response DTOs (Data transfer objects). 

#### Initial Security considerations

- Outside of this project's scope but if I could I would pay for Twilio API for sending text messages and create a 'text me a code' two-factor auth method.
- Same response if it is a wrong password or unknown username to ensure bad actors are not given information based on the error (username confirmation). 
- Also the response time is likely different so perhaps a way to ensure the response times are close for either case.
- TLS required for production

#### Initial Test Plan
I plan to test:
- Successful user creation
- Unique username check
- Case sensitivity for username check
- Two requests at the same time for the same username check
- Password edge cases
- Confirm that passwords are only stored as hashed
- Successful login / authentication
- Error on wrong password
- Error on unknown username
- Trying to create user or authenticate while Redis is shut down
- Ensure that the response time is the same for unknown username and wrong password

#### Research Sources

- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- [OWASP Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)
- [NIST Password Guidelines](https://pages.nist.gov/800-63-4/sp800-63b/passwords/)
- ['How Can Four Random Words Possibly Be More Secure Than 16 Random Characters?' - AskLeo!](https://www.youtube.com/watch?v=ICLyekTM2wU)
- [Have I been PWNED Password Checker and API](https://haveibeenpwned.com/Passwords)
- [Redis Commands](https://redis.io/docs/latest/commands/?name=set)
- [Redis Crash Course](https://www.youtube.com/watch?v=jgpVdJB2sKQ)
- [Redis Keys and Values](https://redis.io/docs/latest/develop/using-commands/keyspace/)
- ChatGPT