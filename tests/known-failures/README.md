# Known audit failures

These diagnostic tests preserve the expected values recorded by the zero-trust audit on 2026-07-27.

Run them explicitly with:

```sh
npm run test:known-failures
```

They currently report five failures in calculation/status and storage-resilience behavior. They are not part of the required cleanup CI because resolving them would change application business logic, which is outside the repository-cleanup scope. Do not change their expected values merely to make the command pass.
