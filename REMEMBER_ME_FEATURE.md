# Remember Me Feature Documentation

## Overview
The "Remember Me" feature allows users to stay logged in on their device indefinitely when they check the "Remember me on this device" checkbox during login.

## How It Works

### When "Remember Me" is CHECKED ✅
- User session persists **indefinitely**
- Token remains valid until explicitly logged out
- Perfect for personal devices and trusted computers
- User won't be logged out even after closing the browser

### When "Remember Me" is NOT CHECKED ❌
- Session expires after **24 hours**
- User will be automatically logged out after 24 hours
- More secure for shared or public computers
- Session ends when the time limit is reached

## Technical Implementation

### Files Modified
1. **LoginPage.tsx** - Added checkbox UI and state management
2. **useAuth.ts** - Updated login function to handle rememberMe preference
3. **apiClient.ts** - Added session expiration checking in request interceptor

### Storage Mechanism
The feature uses `localStorage` to store:
- `token` - The authentication token
- `rememberMe` - Flag indicating if user wants persistent session
- `sessionExpiry` - Timestamp for session expiration (only when rememberMe is false)

### Session Expiration Logic
```typescript
// In apiClient.ts request interceptor
if (!rememberMe && sessionExpiry) {
  if (Date.now() > expiryTime) {
    // Auto logout - session expired
  }
}
```

## User Experience

### Login Page
- Beautiful glassmorphic checkbox below password field
- Label: "Remember me on this device"
- Matches the modern purple/pink gradient theme
- Checkbox state is preserved during the login process

### Session Behavior
- **With Remember Me**: User stays logged in forever (until manual logout)
- **Without Remember Me**: User is logged out after 24 hours of inactivity

## Security Considerations

### Best Practices
- ✅ Use "Remember Me" only on personal, secure devices
- ✅ Always logout from shared computers
- ✅ 24-hour expiration provides good security for non-remembered sessions

### Logout
When user logs out (manually):
- All session data is cleared
- Token is removed
- Remember Me preference is reset
- Session expiry is cleared

## Testing

### Test Scenarios
1. **Login with Remember Me checked**
   - Close browser
   - Reopen browser
   - Navigate to app
   - ✅ Should still be logged in

2. **Login without Remember Me**
   - Wait 24 hours (or modify expiry time for testing)
   - Try to access protected route
   - ✅ Should be redirected to login

3. **Manual Logout**
   - Click logout
   - ✅ All session data should be cleared
   - ✅ Should redirect to login page

## Configuration

### Adjusting Session Duration
To change the 24-hour session duration, modify this line in `useAuth.ts`:

```typescript
// Current: 24 hours
const expiryTime = Date.now() + (24 * 60 * 60 * 1000);

// Example: 12 hours
const expiryTime = Date.now() + (12 * 60 * 60 * 1000);

// Example: 7 days
const expiryTime = Date.now() + (7 * 24 * 60 * 60 * 1000);
```

## Benefits

1. **User Convenience** - No need to login repeatedly on trusted devices
2. **Security** - Automatic logout on shared devices (when not remembered)
3. **Flexibility** - User controls their session persistence
4. **Modern UX** - Matches industry-standard authentication patterns
