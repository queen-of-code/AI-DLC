# Jest Best Practices

## Project Structure

```
project/
├── src/
│   ├── components/
│   │   ├── Button.tsx
│   │   └── Button.test.tsx    # Co-located tests
│   ├── services/
│   │   └── api.ts
│   └── utils/
│       └── helpers.ts
├── tests/
│   ├── setup.ts               # Global setup
│   ├── integration/
│   │   └── api.test.ts
│   └── e2e/
│       └── flows.test.ts
├── jest.config.js
└── package.json
```

## Configuration (jest.config.js)

```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: ['**/*.test.ts', '**/*.test.tsx'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/index.ts',
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 80,
      lines: 80,
    },
  },
};
```

## Basic Tests

```typescript
describe('Calculator', () => {
  describe('add', () => {
    it('should add two positive numbers', () => {
      expect(add(2, 3)).toBe(5);
    });

    it('should handle negative numbers', () => {
      expect(add(-1, 1)).toBe(0);
    });

    it('should handle zero', () => {
      expect(add(0, 5)).toBe(5);
    });
  });
});
```

## Async Tests

```typescript
describe('UserService', () => {
  it('should fetch user by id', async () => {
    const user = await userService.getById('123');
    
    expect(user).toEqual({
      id: '123',
      name: 'Test User',
    });
  });

  it('should throw when user not found', async () => {
    await expect(userService.getById('invalid'))
      .rejects.toThrow('User not found');
  });
});
```

## Mocking

```typescript
// Mock a module
jest.mock('../services/api');

import { fetchUser } from '../services/api';
const mockFetchUser = fetchUser as jest.MockedFunction<typeof fetchUser>;

describe('UserComponent', () => {
  beforeEach(() => {
    mockFetchUser.mockClear();
  });

  it('should display user name', async () => {
    mockFetchUser.mockResolvedValue({ id: '1', name: 'John' });
    
    render(<UserComponent userId="1" />);
    
    expect(await screen.findByText('John')).toBeInTheDocument();
  });
});

// Mock implementation
jest.mock('../services/api', () => ({
  fetchUser: jest.fn().mockResolvedValue({ id: '1', name: 'Mock User' }),
}));
```

## Spies

```typescript
describe('NotificationService', () => {
  it('should call email service on signup', async () => {
    const emailSpy = jest.spyOn(emailService, 'send');
    
    await userService.register('new@example.com');
    
    expect(emailSpy).toHaveBeenCalledWith(
      'new@example.com',
      expect.stringContaining('Welcome')
    );
  });
});
```

## Testing React Components

```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

describe('LoginForm', () => {
  it('should submit with valid credentials', async () => {
    const onSubmit = jest.fn();
    render(<LoginForm onSubmit={onSubmit} />);
    
    await userEvent.type(screen.getByLabelText(/email/i), 'test@example.com');
    await userEvent.type(screen.getByLabelText(/password/i), 'password123');
    await userEvent.click(screen.getByRole('button', { name: /login/i }));
    
    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123',
      });
    });
  });

  it('should show error for invalid email', async () => {
    render(<LoginForm onSubmit={jest.fn()} />);
    
    await userEvent.type(screen.getByLabelText(/email/i), 'invalid');
    await userEvent.click(screen.getByRole('button', { name: /login/i }));
    
    expect(screen.getByText(/invalid email/i)).toBeInTheDocument();
  });
});
```

## Snapshot Testing

```typescript
describe('Button', () => {
  it('should render correctly', () => {
    const { container } = render(<Button>Click me</Button>);
    expect(container).toMatchSnapshot();
  });

  it('should render disabled state', () => {
    const { container } = render(<Button disabled>Click me</Button>);
    expect(container).toMatchSnapshot();
  });
});
```

## Test Data Builders

```typescript
class UserBuilder {
  private user: Partial<User> = {
    id: 'default-id',
    email: 'default@example.com',
    name: 'Default User',
    role: 'user',
  };

  withId(id: string): this {
    this.user.id = id;
    return this;
  }

  withEmail(email: string): this {
    this.user.email = email;
    return this;
  }

  asAdmin(): this {
    this.user.role = 'admin';
    return this;
  }

  build(): User {
    return this.user as User;
  }
}

// Usage
const adminUser = new UserBuilder()
  .withEmail('admin@example.com')
  .asAdmin()
  .build();
```

## Running Tests

```bash
# Run all tests
npm test

# Run with coverage
npm test -- --coverage

# Run specific file
npm test -- src/components/Button.test.tsx

# Run in watch mode
npm test -- --watch

# Run matching pattern
npm test -- --testNamePattern="login"

# Update snapshots
npm test -- -u
```
