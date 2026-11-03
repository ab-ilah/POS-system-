import { useMutation } from '@tanstack/react-query'
import { type FormEvent, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Shell } from '@/app/Shell.tsx'
import { Button } from '@/components/ui/button.tsx'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.tsx'
import { Input } from '@/components/ui/input.tsx'
import { Label } from '@/components/ui/label.tsx'
import { browserAuthGateway, signIn } from '@/lib/data/index.ts'

export function LoginScreen() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const navigate = useNavigate()
  const mutation = useMutation({
    mutationFn: (credentials: { email: string; password: string }) => signIn(credentials, browserAuthGateway()),
    onSuccess: (result) => {
      if (result.ok) navigate('/')
    },
  })

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!email.trim() || !password) {
      setFormError('Email and password are required.')
      return
    }
    setFormError(null)
    mutation.mutate({ email: email.trim(), password })
  }

  const gatewayMessage = mutation.data && !mutation.data.ok ? mutation.data.message : null
  const message = formError ?? gatewayMessage

  return (
    <Shell>
      <Card className="max-w-md">
        <CardHeader>
          <CardTitle>Sign in</CardTitle>
          <p className="text-sm text-muted-foreground">Staff sign in with the account issued for this shop.</p>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={onSubmit}>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>
            {message ? (
              <p role="alert" className="text-sm text-red-800">
                {message}
              </p>
            ) : null}
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </Shell>
  )
}
