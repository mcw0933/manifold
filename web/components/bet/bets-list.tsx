import Link from 'next/link'
import { keyBy, sortBy, partition, sumBy, uniq, groupBy, max } from 'lodash'
import { useEffect, useMemo, useState } from 'react'
import { ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/solid'

import { Bet } from 'web/lib/firebase/bets'
import { User } from 'web/lib/firebase/users'
import {
  formatMoney,
  formatPercent,
  formatWithCommas,
} from 'common/util/format'
import { Col } from '../layout/col'
import { Spacer } from '../layout/spacer'
import {
  Contract,
  contractPath,
  getBinaryProbPercent,
} from 'web/lib/firebase/contracts'
import { Row } from '../layout/row'
import { sellBet } from 'web/lib/firebase/api'
import { ConfirmationButton } from '../buttons/confirmation-button'
import { OutcomeLabel } from '../outcome-label'
import { LoadingIndicator } from '../widgets/loading-indicator'
import { SiteLink } from '../widgets/site-link'
import {
  calculatePayout,
  getContractBetNullMetrics,
  getOutcomeProbability,
  resolvedPayout,
} from 'common/calculate'
import { DPMContract, NumericContract } from 'common/contract'
import { formatNumericProbability } from 'common/pseudo-numeric'
import { useUser } from 'web/hooks/use-user'
import { LimitBet } from 'common/bet'
import { Pagination } from '../widgets/pagination'
import { LimitOrderTable } from './limit-bets'
import { UserLink } from 'web/components/widgets/user-link'
import { BetsSummary } from './bet-summary'
import { ProfitBadge } from '../profit-badge'
import {
  inMemoryStore,
  usePersistentState,
} from 'web/hooks/use-persistent-state'
import { Select } from '../widgets/select'
import { Table } from '../widgets/table'
import { SellRow } from './sell-row'
import {
  calculateDpmSaleAmount,
  getDpmProbabilityAfterSale,
} from 'common/calculate-dpm'
import { getUserContractMetrics } from 'web/lib/supabase/contract-metrics'
import { ContractMetric } from 'common/contract-metric'
import { buildArray, filterDefined } from 'common/util/array'
import { useBets } from 'web/hooks/use-bets'
import { formatTimeShort } from 'web/lib/util/time'
import { getContracts } from 'web/lib/supabase/contracts'
import { getBets } from 'web/lib/supabase/bets'
import { Input } from 'web/components/widgets/input'
import { searchInAny } from 'common/util/parse'

type BetSort = 'newest' | 'profit' | 'loss' | 'closeTime' | 'value'
type BetFilter = 'open' | 'limit_bet' | 'sold' | 'closed' | 'resolved' | 'all'

const CONTRACTS_PER_PAGE = 50
const JUNE_1_2022 = new Date('2022-06-01T00:00:00.000Z').valueOf()
export function BetsList(props: { user: User }) {
  const { user } = props

  const signedInUser = useUser()
  const isYourBets = user.id === signedInUser?.id

  const [metrics, setMetrics] = usePersistentState<
    ContractMetric[] | undefined
  >(undefined, {
    key: `user-contract-metrics-${user.id}`,
    store: inMemoryStore(),
  })

  useEffect(() => {
    getUserContractMetrics(user.id).then(setMetrics)
  }, [user.id, setMetrics])

  const [openLimitBets, setOpenLimitBets] = useState<LimitBet[]>([])
  useEffect(() => {
    getBets({ userId: user.id, isOpenLimitOrder: true, limit: 1000 }).then(
      setOpenLimitBets
    )
  }, [user.id])
  const limitBetsByContract = useMemo(
    () => groupBy(openLimitBets ?? [], (b) => b.contractId),
    [openLimitBets]
  )
  const contractIds = useMemo(
    () =>
      uniq(
        buildArray(
          (metrics ?? []).map((m) => m.contractId),
          Object.keys(limitBetsByContract)
        )
      ),
    [metrics, limitBetsByContract]
  )
  const [loadingContracts, setLoadingContracts] = useState<
    Contract[] | undefined
  >(undefined)
  useEffect(() => {
    if (!metrics) return
    getContracts(contractIds).then((contracts) =>
      setLoadingContracts(filterDefined(contracts))
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contractIds.length, metrics])

  const [sort, setSort] = usePersistentState<BetSort>('newest', {
    key: 'bets-list-sort',
    store: inMemoryStore(),
  })
  const [filter, setFilter] = usePersistentState<BetFilter>('all', {
    key: 'bets-list-filter',
    store: inMemoryStore(),
  })
  const [page, setPage] = usePersistentState(0, {
    key: 'portfolio-page',
    store: inMemoryStore(),
  })
  const [query, setQuery] = useState('')

  const onSetSort = (s: BetSort) => {
    setSort(s)
    setPage(0)
  }

  const onSetFilter = (f: BetFilter) => {
    setFilter(f)
    setPage(0)
  }

  const start = page * CONTRACTS_PER_PAGE
  const end = start + CONTRACTS_PER_PAGE

  if (!metrics || !openLimitBets || !loadingContracts) {
    return <LoadingIndicator />
  }
  if (metrics.length === 0) return <NoBets user={user} />

  const contracts =
    query !== ''
      ? loadingContracts.filter((c) =>
          searchInAny(query, ...[c.question, c.creatorName, c.creatorUsername])
        )
      : loadingContracts
  const initialMetricsByContract = keyBy(metrics, (m) => m.contractId)
  const metricsByContract = Object.fromEntries(
    contractIds.map((cid) => [
      cid,
      initialMetricsByContract[cid] ?? getContractBetNullMetrics(),
    ])
  )

  const FILTERS: Record<BetFilter, (c: Contract) => boolean> = {
    resolved: (c) => !!c.resolutionTime,
    closed: (c) =>
      !FILTERS.resolved(c) && (c.closeTime ?? Infinity) < Date.now(),
    open: (c) => !(FILTERS.closed(c) || FILTERS.resolved(c)),
    all: () => true,
    sold: () => true,
    limit_bet: (c) => FILTERS.open(c),
  }
  const SORTS: Record<BetSort, (c: Contract) => number> = {
    profit: (c) => metricsByContract[c.id].profit,
    loss: (c) => -metricsByContract[c.id].profit,
    value: (c) => metricsByContract[c.id].payout,
    newest: (c) =>
      metricsByContract[c.id]?.lastBetTime ??
      max(limitBetsByContract[c.id]?.map((b) => b.createdTime)) ??
      0,
    closeTime: (c) =>
      // This is in fact the intuitive sort direction.
      (filter === 'open' ? -1 : 1) *
      (c.resolutionTime ?? c.closeTime ?? Infinity),
  }
  const filteredContracts = sortBy(contracts, SORTS[sort])
    .reverse()
    .filter(FILTERS[filter])
    .filter((c) => {
      if (filter === 'all') return true

      const { hasShares } = metricsByContract[c.id]

      if (filter === 'sold') return !hasShares
      if (filter === 'limit_bet') return limitBetsByContract[c.id]?.length > 0
      return hasShares
    })
  const displayedContracts = filteredContracts.slice(start, end)

  const unsettled = contracts.filter(
    (c) => !c.isResolved && metricsByContract[c.id].invested !== 0
  )

  const currentInvested = sumBy(
    unsettled,
    (c) => metricsByContract[c.id].invested
  )
  const currentBetsValue = sumBy(
    unsettled,
    (c) => metricsByContract[c.id].payout
  )
  const currentLoan = sumBy(unsettled, (c) => metricsByContract[c.id].loan)

  const investedProfitPercent =
    ((currentBetsValue - currentInvested) / (currentInvested + 0.1)) * 100

  return (
    <Col>
      <Col className="justify-between gap-4 sm:flex-row">
        <Row className="gap-4">
          <Col className={'shrink-0'}>
            <div className="text-xs text-gray-600 sm:text-sm">
              Investment value
            </div>
            <div className="text-lg">
              {formatMoney(currentBetsValue)}{' '}
              <ProfitBadge profitPercent={investedProfitPercent} />
            </div>
          </Col>
          <Col className={'shrink-0'}>
            <div className="text-xs text-gray-600 sm:text-sm">Total loans</div>
            <div className="text-lg">{formatMoney(currentLoan)}</div>
          </Col>
          <Input
            placeholder="Search"
            className={'w-24 sm:w-full'}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </Row>

        <Row className="gap-2">
          <Select
            value={filter}
            onChange={(e) => onSetFilter(e.target.value as BetFilter)}
          >
            <option value="open">Active</option>
            <option value="limit_bet">Limit orders</option>
            <option value="sold">Sold</option>
            <option value="closed">Closed</option>
            <option value="resolved">Resolved</option>
            <option value="all">All</option>
          </Select>

          <Select
            value={sort}
            onChange={(e) => onSetSort(e.target.value as BetSort)}
          >
            <option value="newest">Recent</option>
            <option value="value">Value</option>
            <option value="profit">Profit</option>
            <option value="loss">Loss</option>
            <option value="closeTime">Close date</option>
          </Select>
        </Row>
      </Col>

      <Col className="mt-6 divide-y">
        {displayedContracts.length === 0 ? (
          <NoMatchingBets />
        ) : (
          <>
            {displayedContracts.map((contract) => (
              <ContractBets
                key={contract.id}
                contract={contract}
                metrics={metricsByContract[contract.id]}
                displayMetric={sort === 'profit' ? 'profit' : 'value'}
                isYourBets={isYourBets}
                userId={user.id}
              />
            ))}
            <Pagination
              page={page}
              itemsPerPage={CONTRACTS_PER_PAGE}
              totalItems={filteredContracts.length}
              setPage={setPage}
            />
          </>
        )}
      </Col>
    </Col>
  )
}

const NoBets = ({ user }: { user: User }) => {
  const me = useUser()
  return (
    <div className="mx-4 py-4 text-gray-500">
      {user.id === me?.id ? (
        <>
          You have not made any bets yet.{' '}
          <SiteLink href="/home" className="underline">
            Find a prediction market!
          </SiteLink>
        </>
      ) : (
        <>{user.name} has not made any public bets yet.</>
      )}
    </div>
  )
}
const NoMatchingBets = () => (
  <div className="mx-4 py-4 text-gray-500">
    No bets matching the current filter.
  </div>
)

function ContractBets(props: {
  contract: Contract
  metrics: ContractMetric
  displayMetric: 'profit' | 'value'
  isYourBets: boolean
  userId: string
}) {
  const { contract, metrics, displayMetric, isYourBets, userId } = props
  const { resolution, closeTime, outcomeType, isResolved } = contract

  const user = useUser()

  // Hide bets before 06-01-2022 if this isn't your own profile
  const hideBetsBefore = isYourBets ? 0 : JUNE_1_2022
  const bets = useBets({
    contractId: contract.id,
    userId,
    afterTime: hideBetsBefore,
  })

  const limitBets = (bets ?? []).filter(
    (bet) => bet.limitProb !== undefined && !bet.isCancelled && !bet.isFilled
  ) as LimitBet[]
  const resolutionValue = (contract as NumericContract).resolutionValue

  const [collapsed, setCollapsed] = useState(true)

  const isBinary = outcomeType === 'BINARY'
  const isClosed = closeTime && closeTime < Date.now()

  const { payout, profit, profitPercent } = metrics

  return (
    <div tabIndex={0} className="relative bg-white p-4 pr-6">
      <Row
        className="cursor-pointer flex-wrap gap-2"
        onClick={() => setCollapsed((collapsed) => !collapsed)}
      >
        <Col className="flex-[2] gap-1">
          <Row className="mr-2 max-w-lg">
            <Link
              href={contractPath(contract)}
              className="font-medium text-indigo-700 hover:underline hover:decoration-indigo-400 hover:decoration-2"
              onClick={(e) => e.stopPropagation()}
            >
              {contract.question}
            </Link>

            {/* Show carrot for collapsing. Hack the positioning. */}
            {collapsed ? (
              <ChevronDownIcon className="absolute top-5 right-4 h-6 w-6" />
            ) : (
              <ChevronUpIcon className="absolute top-5 right-4 h-6 w-6" />
            )}
          </Row>

          <Row className="flex-1 items-center gap-2 text-sm text-gray-500">
            {resolution ? (
              <>
                <div>
                  Resolved{' '}
                  <OutcomeLabel
                    outcome={resolution}
                    value={resolutionValue}
                    contract={contract}
                    truncate="short"
                  />
                </div>
                <div>•</div>
              </>
            ) : isBinary ? (
              <>
                <div className="text-lg text-teal-500">
                  {getBinaryProbPercent(contract)}
                </div>
                <div>•</div>
              </>
            ) : null}
            <UserLink
              name={contract.creatorName}
              username={contract.creatorUsername}
            />
          </Row>
        </Col>

        <Col className="mr-5 sm:mr-8">
          <div className="whitespace-nowrap text-right text-lg">
            {formatMoney(displayMetric === 'profit' ? profit : payout)}
          </div>
          <ProfitBadge className="text-right" profitPercent={profitPercent} />
        </Col>
      </Row>

      {!collapsed && (
        <div className="bg-white">
          <BetsSummary
            className="mt-8 mr-5 flex-1 sm:mr-8"
            contract={contract}
            metrics={metrics}
            hideTweet
          />

          {isYourBets &&
            !isResolved &&
            !isClosed &&
            contract.outcomeType === 'BINARY' && (
              <SellRow
                className="mt-4 items-start"
                contract={contract}
                user={user}
              />
            )}

          {contract.mechanism === 'cpmm-1' && limitBets.length > 0 && (
            <div className="max-w-md">
              <div className="mt-4 bg-gray-50 px-4 py-2">Limit orders</div>
              <LimitOrderTable
                contract={contract}
                limitBets={limitBets}
                isYou={isYourBets}
              />
            </div>
          )}

          <div className="mt-4 bg-gray-50 px-4 py-2">Bets</div>
          {bets ? (
            <ContractBetsTable
              contract={contract}
              bets={bets}
              isYourBets={isYourBets}
            />
          ) : (
            <LoadingIndicator />
          )}
        </div>
      )}
    </div>
  )
}

export function ContractBetsTable(props: {
  contract: Contract
  bets: Bet[]
  isYourBets: boolean
}) {
  const { contract, isYourBets } = props
  const { isResolved, mechanism, outcomeType } = contract

  const bets = sortBy(
    props.bets.filter((b) => !b.isAnte && b.amount !== 0),
    (bet) => bet.createdTime
  ).reverse()

  const [sales, buys] = partition(bets, (bet) => bet.sale)

  const salesDict = Object.fromEntries(
    sales.map((sale) => [sale.sale?.betId ?? '', sale])
  )

  const [redemptions, normalBets] = partition(
    mechanism === 'cpmm-1' ? bets : buys,
    (b) => b.isRedemption
  )
  const firstOutcome = redemptions[0]?.outcome
  const amountRedeemed = Math.floor(
    sumBy(
      redemptions.filter((r) => r.outcome === firstOutcome),
      (b) => -1 * b.shares
    )
  )

  const amountLoaned = sumBy(
    bets.filter((bet) => !bet.isSold && !bet.sale),
    (bet) => bet.loanAmount ?? 0
  )

  const isCPMM = mechanism === 'cpmm-1'
  const isCPMM2 = mechanism === 'cpmm-2'
  const isDPM = mechanism === 'dpm-2'
  const isNumeric = outcomeType === 'NUMERIC'
  const isPseudoNumeric = outcomeType === 'PSEUDO_NUMERIC'

  return (
    <div className="overflow-x-auto">
      {amountRedeemed > 0 && (
        <>
          <div className="pl-2 text-sm text-gray-500">
            {isCPMM2 ? (
              <>
                {amountRedeemed} shares of each outcome redeemed for{' '}
                {formatMoney(amountRedeemed)}.
              </>
            ) : (
              <>
                {amountRedeemed} {isPseudoNumeric ? 'HIGHER' : 'YES'} shares and{' '}
                {amountRedeemed} {isPseudoNumeric ? 'LOWER' : 'NO'} shares
                automatically redeemed for {formatMoney(amountRedeemed)}.
              </>
            )}
          </div>
          <Spacer h={4} />
        </>
      )}

      {!isResolved && amountLoaned > 0 && (
        <>
          <div className="pl-2 text-sm text-gray-500">
            {isYourBets ? (
              <>You currently have a loan of {formatMoney(amountLoaned)}.</>
            ) : (
              <>
                This user currently has a loan of {formatMoney(amountLoaned)}.
              </>
            )}
          </div>
          <Spacer h={4} />
        </>
      )}

      <Table>
        <thead>
          <tr className="p-2">
            <th></th>
            {isCPMM && <th>Type</th>}
            <th>Outcome</th>
            <th>Amount</th>
            {isDPM && !isNumeric && (
              <th>{isResolved ? <>Payout</> : <>Sale price</>}</th>
            )}
            {isDPM && !isResolved && <th>Payout if chosen</th>}
            <th>Shares</th>
            {!isPseudoNumeric && <th>Probability</th>}
            <th>Date</th>
          </tr>
        </thead>
        <tbody>
          {normalBets.map((bet) => (
            <BetRow
              key={bet.id}
              bet={bet}
              saleBet={salesDict[bet.id]}
              contract={contract}
              isYourBet={isYourBets}
            />
          ))}
        </tbody>
      </Table>
    </div>
  )
}

function BetRow(props: {
  bet: Bet
  contract: Contract
  saleBet?: Bet
  isYourBet: boolean
}) {
  const { bet, saleBet, contract, isYourBet } = props
  const {
    amount,
    outcome,
    createdTime,
    probBefore,
    probAfter,
    shares,
    isSold,
    isAnte,
  } = bet

  const { isResolved, closeTime, mechanism, outcomeType } = contract

  const isClosed = closeTime && Date.now() > closeTime

  const isCPMM = mechanism === 'cpmm-1'
  const isCPMM2 = mechanism === 'cpmm-2'
  const isShortSell = isCPMM2 && bet.amount > 0 && bet.shares === 0
  const isNumeric = outcomeType === 'NUMERIC'
  const isPseudoNumeric = outcomeType === 'PSEUDO_NUMERIC'
  const isDPM = mechanism === 'dpm-2'

  const dpmPayout = (() => {
    if (!isDPM) return 0

    const saleBetAmount = saleBet?.sale?.amount
    if (saleBetAmount) {
      return saleBetAmount
    } else if (contract.isResolved) {
      return resolvedPayout(contract, bet)
    } else {
      return calculateDpmSaleAmount(contract, bet)
    }
  })()

  const saleDisplay = !isDPM ? (
    ''
  ) : isAnte ? (
    'ANTE'
  ) : saleBet ? (
    <>{formatMoney(dpmPayout)} (sold)</>
  ) : (
    formatMoney(dpmPayout)
  )

  const payoutIfChosenDisplay =
    bet.isAnte && outcomeType === 'FREE_RESPONSE' && bet.outcome === '0'
      ? 'N/A'
      : formatMoney(calculatePayout(contract, bet, bet.outcome))

  const hadPoolMatch =
    (bet.limitProb === undefined ||
      bet.fills?.some((fill) => fill.matchedBetId === null)) ??
    false

  const ofTotalAmount =
    bet.limitProb === undefined || bet.orderAmount === undefined
      ? ''
      : ` / ${formatMoney(bet.orderAmount)}`

  const sharesOrShortSellShares =
    isShortSell && bet.sharesByOutcome
      ? -Math.max(...Object.values(bet.sharesByOutcome))
      : Math.abs(shares)

  return (
    <tr>
      <td className="text-gray-700">
        {isYourBet &&
          isDPM &&
          !isNumeric &&
          !isResolved &&
          !isClosed &&
          !isSold &&
          !isAnte && <DpmSellButton contract={contract} bet={bet} />}
      </td>
      {isCPMM && <td>{shares >= 0 ? 'BUY' : 'SELL'}</td>}
      <td>
        {isCPMM2 && (isShortSell ? 'NO ' : 'YES ')}
        {bet.isAnte ? (
          'ANTE'
        ) : (
          <OutcomeLabel
            outcome={outcome}
            value={(bet as any).value}
            contract={contract}
            truncate="short"
          />
        )}
        {isPseudoNumeric &&
          ' than ' + formatNumericProbability(bet.probAfter, contract)}
      </td>
      <td>
        {formatMoney(Math.abs(amount))}
        {ofTotalAmount}
      </td>
      {isDPM && !isNumeric && <td>{saleDisplay}</td>}
      {isDPM && !isResolved && <td>{payoutIfChosenDisplay}</td>}
      <td>{formatWithCommas(sharesOrShortSellShares)}</td>
      {!isPseudoNumeric && (
        <td>
          {outcomeType === 'FREE_RESPONSE' || hadPoolMatch ? (
            <>
              {formatPercent(probBefore)} → {formatPercent(probAfter)}
            </>
          ) : (
            formatPercent(bet.limitProb ?? 0)
          )}
        </td>
      )}
      <td>{formatTimeShort(createdTime)}</td>
    </tr>
  )
}

function DpmSellButton(props: { contract: DPMContract; bet: Bet }) {
  const { contract, bet } = props
  const { outcome, shares, loanAmount } = bet

  const [isSubmitting, setIsSubmitting] = useState(false)

  const initialProb = getOutcomeProbability(
    contract,
    outcome === 'NO' ? 'YES' : outcome
  )

  const outcomeProb = getDpmProbabilityAfterSale(
    contract.totalShares,
    outcome,
    shares
  )

  const saleAmount = calculateDpmSaleAmount(contract, bet)
  const profit = saleAmount - bet.amount

  return (
    <ConfirmationButton
      openModalBtn={{
        label: 'Sell',
        disabled: isSubmitting,
      }}
      submitBtn={{ label: 'Sell', color: 'green' }}
      onSubmit={async () => {
        setIsSubmitting(true)
        await sellBet({ contractId: contract.id, betId: bet.id })
        setIsSubmitting(false)
      }}
    >
      <div className="mb-4 text-xl">
        Sell {formatWithCommas(shares)} shares of{' '}
        <OutcomeLabel outcome={outcome} contract={contract} truncate="long" />{' '}
        for {formatMoney(saleAmount)}?
      </div>
      {!!loanAmount && (
        <div className="mt-2">
          You will also pay back {formatMoney(loanAmount)} of your loan, for a
          net of {formatMoney(saleAmount - loanAmount)}.
        </div>
      )}

      <div className="mt-2 mb-1 text-sm">
        {profit > 0 ? 'Profit' : 'Loss'}: {formatMoney(profit).replace('-', '')}
        <br />
        Market probability: {formatPercent(initialProb)} →{' '}
        {formatPercent(outcomeProb)}
      </div>
    </ConfirmationButton>
  )
}
