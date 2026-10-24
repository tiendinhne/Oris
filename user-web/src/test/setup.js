import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

// Vitest không bật globals nên RTL không tự dọn DOM sau mỗi test
afterEach(cleanup)
