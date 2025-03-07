import * as React from 'react'

export const RectangleGroup = (
  props: React.ComponentProps<'svg'>
): JSX.Element => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill={props.fill || 'none'}
    viewBox="0 0 24 24"
    strokeWidth={props.strokeWidth || 1.75}
    stroke={props.stroke || 'currentColor'}
    className={props.className ? props.className : 'h-6 w-6'}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M2.25 7.125C2.25 6.504 2.754 6 3.375 6h6c.621 0 1.125.504 1.125 1.125v3.75c0 .621-.504 1.125-1.125 1.125h-6a1.125 1.125 0 01-1.125-1.125v-3.75zM14.25 8.625c0-.621.504-1.125 1.125-1.125h5.25c.621 0 1.125.504 1.125 1.125v8.25c0 .621-.504 1.125-1.125 1.125h-5.25a1.125 1.125 0 01-1.125-1.125v-8.25zM3.75 16.125c0-.621.504-1.125 1.125-1.125h5.25c.621 0 1.125.504 1.125 1.125v2.25c0 .621-.504 1.125-1.125 1.125h-5.25a1.125 1.125 0 01-1.125-1.125v-2.25z"
    />
  </svg>
)
