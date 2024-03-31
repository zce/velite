export function Callout({ type = 'default', ...props }: { children?: React.ReactNode; type?: 'default' | 'warning' | 'danger' }) {
  return (
    <div
      className={`my-6 flex items-start rounded-md border border-l-4 p-4${type === 'danger' ? ' border-red-900 bg-red-50' : type === 'warning' ? ' border-yellow-900 bg-yellow-50' : ''}`}
      {...props}
    />
  )
}
