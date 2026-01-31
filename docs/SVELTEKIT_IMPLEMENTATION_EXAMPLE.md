# SvelteKit + TypeScript Implementation - AI Receptionist

## Frontend Component (SvelteKit)

**Why SvelteKit**:
- ✅ NextBeat uses SvelteKit (exact match!)
- ✅ Modern, reactive framework
- ✅ Better performance than React (smaller bundle)
- ✅ TypeScript support built-in
- ✅ Shows you can learn new frameworks

### File Structure

```
src/
├── routes/
│   ├── +page.svelte              # Main AI Receptionist page
│   ├── +page.ts                  # Page load function
│   └── api/
│       └── allergen-query/
│           └── +server.ts        # API endpoint
├── lib/
│   ├── components/
│   │   ├── ChatMessage.svelte    # Message component
│   │   ├── MenuItemCard.svelte   # Menu item display
│   │   └── LoadingDots.svelte    # Loading animation
│   ├── stores/
│   │   └── chat.ts               # Chat state store
│   └── types/
│       └── allergen.ts           # TypeScript types
```

---

## Implementation

### 1. TypeScript Types

```typescript
// src/lib/types/allergen.ts
export interface AllergenQuery {
  message: string;
  sessionId: string;
}

export interface MenuItem {
  id: string;
  name: string;
  nameJa?: string;
  allergens: string[];
  price: number;
  description?: string;
}

export interface AllergenResponse {
  response: string;
  safeItems: MenuItem[];
  unsafeItems: MenuItem[];
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  safeItems?: MenuItem[];
  unsafeItems?: MenuItem[];
  timestamp: Date;
}

export type AllergenType =
  | 'gluten'
  | 'dairy'
  | 'eggs'
  | 'shellfish'
  | 'fish'
  | 'nuts'
  | 'peanuts'
  | 'soy'
  | 'sesame'
  | 'alcohol';
```

---

### 2. Svelte Store for Chat State

```typescript
// src/lib/stores/chat.ts
import { writable } from 'svelte/store';
import type { ChatMessage } from '$lib/types/allergen';

function createChatStore() {
  const { subscribe, update } = writable<ChatMessage[]>([
    {
      role: 'assistant',
      content:
        'Hello! I\'m your AI receptionist. I can help you find menu items based on your dietary restrictions. What allergens should I avoid?',
      timestamp: new Date()
    }
  ]);

  return {
    subscribe,
    addMessage: (message: ChatMessage) => {
      update((messages) => [...messages, message]);
    },
    clear: () => {
      update(() => []);
    }
  };
}

export const chatStore = createChatStore();
```

---

### 3. API Endpoint (SvelteKit Server Route)

```typescript
// src/routes/api/allergen-query/+server.ts
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { AllergenQuery, AllergenResponse } from '$lib/types/allergen';

// Import your backend service (Scala/NestJS)
// For this example, we'll use fetch to call external API

export const POST: RequestHandler = async ({ request }) => {
  try {
    const query: AllergenQuery = await request.json();

    // Call your Scala/NestJS backend
    const response = await fetch('http://localhost:8080/api/allergen-query', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(query)
    });

    if (!response.ok) {
      throw new Error(`Backend error: ${response.statusText}`);
    }

    const data: AllergenResponse = await response.json();

    return json(data);
  } catch (error) {
    console.error('Allergen query error:', error);
    return json(
      {
        response: 'Sorry, I encountered an error. Please try again.',
        safeItems: [],
        unsafeItems: []
      },
      { status: 500 }
    );
  }
};
```

---

### 4. Main Chat Component

```svelte
<!-- src/routes/+page.svelte -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { chatStore } from '$lib/stores/chat';
  import ChatMessage from '$lib/components/ChatMessage.svelte';
  import LoadingDots from '$lib/components/LoadingDots.svelte';
  import type { AllergenQuery, AllergenResponse } from '$lib/types/allergen';

  let input = '';
  let loading = false;
  let sessionId: string;
  let chatContainer: HTMLElement;

  onMount(() => {
    // Generate or retrieve session ID
    sessionId = sessionStorage.getItem('receptionist_session') || crypto.randomUUID();
    sessionStorage.setItem('receptionist_session', sessionId);
  });

  async function sendMessage() {
    if (!input.trim() || loading) return;

    const userMessage = {
      role: 'user' as const,
      content: input.trim(),
      timestamp: new Date()
    };

    chatStore.addMessage(userMessage);
    const currentInput = input;
    input = '';
    loading = true;

    // Scroll to bottom
    setTimeout(() => scrollToBottom(), 100);

    try {
      const query: AllergenQuery = {
        message: currentInput,
        sessionId
      };

      const response = await fetch('/api/allergen-query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(query)
      });

      if (!response.ok) {
        throw new Error('Failed to get response');
      }

      const data: AllergenResponse = await response.json();

      chatStore.addMessage({
        role: 'assistant',
        content: data.response,
        safeItems: data.safeItems,
        unsafeItems: data.unsafeItems,
        timestamp: new Date()
      });

      setTimeout(() => scrollToBottom(), 100);
    } catch (error) {
      console.error('Send message error:', error);
      chatStore.addMessage({
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date()
      });
    } finally {
      loading = false;
    }
  }

  function handleKeyPress(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  }

  function scrollToBottom() {
    if (chatContainer) {
      chatContainer.scrollTop = chatContainer.scrollHeight;
    }
  }
</script>

<div class="flex flex-col h-screen max-w-4xl mx-auto p-4">
  <!-- Header -->
  <header class="mb-4">
    <h1 class="text-2xl font-bold text-gray-900">🤖 AI Receptionist</h1>
    <p class="text-sm text-gray-600">
      Ask about menu allergens and dietary restrictions
    </p>
  </header>

  <!-- Messages Container -->
  <div
    bind:this={chatContainer}
    class="flex-1 overflow-y-auto space-y-4 mb-4 px-2"
  >
    {#each $chatStore as message (message.timestamp.getTime())}
      <ChatMessage {message} />
    {/each}

    {#if loading}
      <div class="flex justify-start">
        <div class="bg-gray-100 rounded-lg p-3">
          <LoadingDots />
        </div>
      </div>
    {/if}
  </div>

  <!-- Input Area -->
  <div class="flex gap-2">
    <input
      type="text"
      bind:value={input}
      on:keypress={handleKeyPress}
      placeholder="Ask about allergens... (e.g., 'I'm allergic to shellfish')"
      disabled={loading}
      class="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
    />
    <button
      on:click={sendMessage}
      disabled={loading || !input.trim()}
      class="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
    >
      Send
    </button>
  </div>
</div>

<style>
  /* Add any component-specific styles here */
  :global(body) {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue',
      Arial, sans-serif;
  }
</style>
```

---

### 5. ChatMessage Component

```svelte
<!-- src/lib/components/ChatMessage.svelte -->
<script lang="ts">
  import type { ChatMessage } from '$lib/types/allergen';
  import MenuItemCard from './MenuItemCard.svelte';

  export let message: ChatMessage;

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('ja-JP', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };
</script>

<div class="flex {message.role === 'user' ? 'justify-end' : 'justify-start'}">
  <div
    class="max-w-[70%] rounded-lg p-3 {message.role === 'user'
      ? 'bg-blue-500 text-white'
      : 'bg-gray-100 text-gray-900'}"
  >
    <!-- Message Content -->
    <p class="whitespace-pre-wrap">{message.content}</p>

    <!-- Safe Items -->
    {#if message.safeItems && message.safeItems.length > 0}
      <div class="mt-3 pt-3 border-t border-gray-300">
        <p class="font-semibold text-sm mb-2">✅ Safe for you:</p>
        <div class="space-y-2">
          {#each message.safeItems.slice(0, 5) as item}
            <MenuItemCard {item} />
          {/each}
        </div>
      </div>
    {/if}

    <!-- Timestamp -->
    <p class="text-xs mt-2 opacity-70">
      {formatTime(message.timestamp)}
    </p>
  </div>
</div>
```

---

### 6. MenuItemCard Component

```svelte
<!-- src/lib/components/MenuItemCard.svelte -->
<script lang="ts">
  import type { MenuItem } from '$lib/types/allergen';

  export let item: MenuItem;

  const allergenIcons: Record<string, string> = {
    gluten: '🌾',
    dairy: '🥛',
    eggs: '🥚',
    shellfish: '🦐',
    fish: '🐟',
    nuts: '🥜',
    peanuts: '🥜',
    soy: '🫘',
    sesame: '🌰',
    alcohol: '🍷'
  };
</script>

<div class="flex justify-between items-start text-sm bg-white rounded p-2">
  <div class="flex-1">
    <p class="font-medium">{item.name}</p>
    {#if item.nameJa}
      <p class="text-xs text-gray-600">{item.nameJa}</p>
    {/if}

    {#if item.allergens && item.allergens.length > 0}
      <div class="flex gap-1 mt-1">
        {#each item.allergens as allergen}
          <span
            class="text-xs px-2 py-0.5 bg-yellow-100 text-yellow-800 rounded"
            title={allergen}
          >
            {allergenIcons[allergen] || '⚠️'} {allergen}
          </span>
        {/each}
      </div>
    {:else}
      <p class="text-xs text-green-600 mt-1">✓ No allergens</p>
    {/if}
  </div>

  <p class="font-mono text-gray-700 ml-2">¥{item.price.toFixed(0)}</p>
</div>
```

---

### 7. LoadingDots Component

```svelte
<!-- src/lib/components/LoadingDots.svelte -->
<div class="flex space-x-2">
  <div class="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
  <div
    class="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
    style="animation-delay: 0.1s"
  />
  <div
    class="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
    style="animation-delay: 0.2s"
  />
</div>
```

---

## Project Setup

### 1. Initialize SvelteKit Project

```bash
# Create new SvelteKit project
npm create svelte@latest ai-receptionist
cd ai-receptionist

# Choose options:
# - Skeleton project
# - TypeScript syntax
# - ESLint, Prettier

# Install dependencies
npm install

# Install Tailwind CSS (optional)
npx svelte-add@latest tailwindcss
npm install
```

### 2. Project Configuration

```typescript
// svelte.config.js
import adapter from '@sveltejs/adapter-auto';
import { vitePreprocess } from '@sveltejs/kit/vite';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),

  kit: {
    adapter: adapter(),
    alias: {
      $lib: 'src/lib'
    }
  }
};

export default config;
```

```json
// tsconfig.json
{
  "extends": "./.svelte-kit/tsconfig.json",
  "compilerOptions": {
    "allowJs": true,
    "checkJs": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "skipLibCheck": true,
    "sourceMap": true,
    "strict": true,
    "moduleResolution": "bundler"
  }
}
```

### 3. Run Development Server

```bash
# Start dev server
npm run dev

# Open browser
# http://localhost:5173
```

---

## Deployment

### Option 1: Vercel (Recommended for SvelteKit)

```bash
# Install Vercel adapter
npm install -D @sveltejs/adapter-vercel

# Update svelte.config.js
import adapter from '@sveltejs/adapter-vercel';
```

```bash
# Deploy
npx vercel --prod
```

### Option 2: Cloudflare Pages

```bash
# Install Cloudflare adapter
npm install -D @sveltejs/adapter-cloudflare

# Build
npm run build

# Deploy to Cloudflare Pages
```

### Option 3: Docker + Railway/Fly.io

```dockerfile
# Dockerfile
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:18-alpine
WORKDIR /app
COPY --from=builder /app/build build/
COPY --from=builder /app/package.json .
COPY --from=builder /app/package-lock.json .
RUN npm ci --production
EXPOSE 3000
CMD ["node", "build"]
```

---

## Performance Comparison

### SvelteKit vs React (Bundle Size)

| Metric | SvelteKit | React |
|--------|-----------|-------|
| **Initial JS** | ~25KB | ~140KB (React + ReactDOM) |
| **Component Code** | Compiled to vanilla JS | Virtual DOM overhead |
| **Runtime** | No runtime | React runtime required |
| **Reactivity** | Compiler-based | useState/useEffect hooks |
| **Bundle** | ~50KB total | ~200KB+ total |

**Result**: **75% smaller bundle** with SvelteKit! ✅

---

## Why This Impresses NextBeat

1. ✅ **Exact Tech Stack Match**: SvelteKit (NextBeat uses this!)
2. ✅ **TypeScript**: Strongly-typed, shows attention to code quality
3. ✅ **Modern Framework**: Not React (everyone uses React)
4. ✅ **Performance**: 75% smaller bundle than React
5. ✅ **Learning Ability**: Shows you can learn new frameworks quickly
6. ✅ **Research**: You researched their tech stack and adapted

**Interview Talking Point**:
> "I noticed NextBeat uses SvelteKit, so I implemented the AI Receptionist feature using SvelteKit + TypeScript instead of React. This demonstrates:
> 1. I researched your tech stack
> 2. I can learn new frameworks quickly (learned SvelteKit in 1 week)
> 3. I value performance (SvelteKit bundle is 75% smaller than React)
> 4. I'm immediately productive with your stack on day 1"

---

## Learning Resources

**SvelteKit Tutorials** (1 week to proficiency):
1. Official Tutorial: https://learn.svelte.dev/
2. SvelteKit Docs: https://kit.svelte.dev/docs
3. TypeScript + Svelte: https://svelte.dev/docs/typescript

**Estimated Learning Time**:
- Day 1-2: Svelte basics (components, reactivity)
- Day 3-4: SvelteKit (routing, server routes, load functions)
- Day 5-7: Build AI Receptionist feature

**Result**: Production-ready SvelteKit app in 1 week! ✅
