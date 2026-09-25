'use client'

import { Component, type ReactNode } from 'react'

interface Props {
  fallback: ReactNode
  children: ReactNode
}

/**
 * Catches errors thrown by Clerk hooks when ClerkProvider is not in the tree
 * (e.g. during development with placeholder keys). Renders `fallback` instead.
 */
export class ClerkBoundary extends Component<Props, { hasError: boolean }> {
  state = { hasError: false }

  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true }
  }

  render() {
    if (this.state.hasError) return this.props.fallback
    return this.props.children
  }
}
