export function parseCookies(request, _response, next) {
  request.cookies = Object.fromEntries(
    (request.headers.cookie || '').split(';').map((part) => {
      const separator = part.indexOf('=')
      if (separator < 0) return ['', '']
      const key = part.slice(0, separator).trim()
      try {
        return [key, decodeURIComponent(part.slice(separator + 1).trim())]
      } catch {
        return [key, '']
      }
    }).filter(([key]) => key),
  )
  next()
}
