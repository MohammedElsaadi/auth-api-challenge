# Auth API Challenge

## Table of Contents
1. [Getting Started](#getting-started)
2. [Approaching this challenge](#approaching-this-challenge)

## Getting Started
Copy .env.example to .env and enter a password

## Approaching This Challenge
### Introduction
This document captures my initial understanding of the assignment, the questions that came to mind before implementing, and the reasoning behind my eventual implementation decisions.

I am writing it before beginning development so the repository showcases how my approach evolves and will provide insight to my thought process. My goal is to show how I appraoch unfamiliar tasks and how I research, learn, and make informed decisions.

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

Asking why to use NX instead of checking EXISTS first confirmed what I expected, which is to avoid a race condition if done separately. If two requests came in at the same time for the same username, using NX with SET would only allow one request to create the username and correctly provide username is unavailable to the other request.

I will be storing key-value pairs using the lowercase form of the username as the key and JSON as the value to keep user records.

#### Password Securtity

Having worked with credential storage previously, I know passwords should never be stored in plaintext or encrypted in a way where a key can decrpt it. By hashing with Argon2id I can ensure a one way conversion that cannot be undone to retrieve the original password.

I plan to enforce min and max character limits, and allow special characters for complexity. I also will create a block list of common passwords like password123!

For the password storage I will use Argon2id over bcrypt as it is the best rated password hashing algorithm by OWASP.

#### Framework Decision

My previous Node.js experience was with Next.js where backend endpoints were part of a larger React application. This assignment does not require a front end or server side rendering.

I researched and compared frameworks for Node.js and landed on Fastify as it provides schema-based response validations which feels like a clean system that aligns with my .NET experience. I also have read a lot that it is much faster and offers great error handling.

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
- Password edgecases
- Confirm that passwords are only stored as hashed
- Successful login / authentication
- Error on wrong password
- Error on unknown username
- Trying to create user or authenticate while Redis is shut down
- Ensure that the response timeis the same for unknown username and wrong password

#### Research Sources

- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- [OWASP Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)
- [Redis Commands](https://redis.io/docs/latest/commands/?name=set)
- [Redis Crash Course](https://www.youtube.com/watch?v=jgpVdJB2sKQ)
- ChatGPT