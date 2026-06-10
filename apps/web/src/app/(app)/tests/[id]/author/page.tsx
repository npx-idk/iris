import { redirect } from 'next/navigation'

export default function AuthorRedirect({ params }: { params: { id: string } }) {
  redirect(`/tests/${params.id}`)
}
