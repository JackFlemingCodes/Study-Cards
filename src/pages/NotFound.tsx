import { Link } from 'react-router-dom'

export function NotFound() {
  return (
    <div className="empty">
      <h2>Page not found</h2>
      <Link className="btn btn-primary" to="/">
        Go to library
      </Link>
    </div>
  )
}
