import { useRouter } from 'next/router'
import { SearchableGrid } from '../../components/contracts-list'
import { Header } from '../../components/header'
import { Title } from '../../components/title'
import { useContracts } from '../../hooks/use-contracts'

export default function TagPage() {
  const router = useRouter()
  const { tag } = router.query as { tag: string }

  let contracts = useContracts()

  if (tag && contracts !== 'loading') {
    contracts = contracts.filter(
      (contract) =>
        contract.description.toLowerCase().includes(`#${tag.toLowerCase()}`) ||
        contract.question.toLowerCase().includes(`#${tag.toLowerCase()}`)
    )
  }

  return (
    <div className="max-w-4xl px-4 pb-8 mx-auto">
      <Header />
      <Title text={`#${tag}`} />
      <SearchableGrid contracts={contracts === 'loading' ? [] : contracts} />
    </div>
  )
}
