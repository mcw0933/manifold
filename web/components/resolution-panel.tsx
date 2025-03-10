import React, { useState } from 'react'

import { User } from 'web/lib/firebase/users'
import { YesNoCancelSelector } from './bet/yes-no-selector'
import { Spacer } from './layout/spacer'
import { ResolveConfirmationButton } from './buttons/confirmation-button'
import { APIError, resolveMarket } from 'web/lib/firebase/api'
import { getProbability } from 'common/calculate'
import { BinaryContract, resolution } from 'common/contract'
import { BETTORS, PLURAL_BETS } from 'common/user'
import { Row } from 'web/components/layout/row'
import { capitalize } from 'lodash'
import { ProbabilityInput } from './widgets/probability-input'
import { GradientContainer } from './widgets/gradient-container'

export function ResolutionPanel(props: {
  isAdmin: boolean
  isCreator: boolean
  creator: User
  contract: BinaryContract
  className?: string
}) {
  const { contract, className, isAdmin, isCreator } = props

  // const earnedFees =
  //   contract.mechanism === 'dpm-2'
  //     ? `${DPM_CREATOR_FEE * 100}% of trader profits`
  //     : `${formatMoney(contract.collectedFees.creatorFee)} in fees`

  const [outcome, setOutcome] = useState<resolution | undefined>()

  const [prob, setProb] = useState<number | undefined>(
    Math.round(getProbability(contract) * 100)
  )

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | undefined>(undefined)

  const resolve = async () => {
    if (!outcome) return

    setIsSubmitting(true)

    try {
      const result = await resolveMarket({
        outcome,
        contractId: contract.id,
        probabilityInt: prob,
      })
      console.log('resolved', outcome, 'result:', result)
    } catch (e) {
      if (e instanceof APIError) {
        setError(e.toString())
      } else {
        console.error(e)
        setError('Error resolving market')
      }
    }

    setIsSubmitting(false)
  }

  return (
    <GradientContainer className={className}>
      {isAdmin && !isCreator && (
        <span className="bg-scarlet-50 text-scarlet-500 absolute right-4 top-4 rounded p-1 text-xs">
          ADMIN
        </span>
      )}
      <div className="mb-6">Resolve your market</div>
      <YesNoCancelSelector
        className="mx-auto my-2"
        selected={outcome}
        onSelect={setOutcome}
      />

      <Spacer h={4} />
      {!!error && <div className="text-scarlet-500">{error}</div>}

      <Row className={'items-center justify-between'}>
        <div className="text-sm">
          {outcome === 'YES' ? (
            <>
              Winnings will be paid out to {BETTORS} who bought YES.
              {/* <br />
            <br />
            You will earn {earnedFees}. */}
            </>
          ) : outcome === 'NO' ? (
            <>
              Winnings will be paid out to {BETTORS} who bought NO.
              {/* <br />
            <br />
            You will earn {earnedFees}. */}
            </>
          ) : outcome === 'CANCEL' ? (
            <>Cancel all trades and return money back to {BETTORS}.</>
          ) : outcome === 'MKT' ? (
            <>
              {capitalize(PLURAL_BETS)} will be paid out at the probability you
              specify:
            </>
          ) : (
            <span className="text-gray-500">
              Resolving this market will immediately pay out {BETTORS}.
            </span>
          )}
        </div>
        {outcome === 'MKT' && (
          <ProbabilityInput
            prob={prob}
            onChange={setProb}
            inputClassName="w-28 mr-3 !h-11"
          />
        )}
        <ResolveConfirmationButton
          color={
            outcome === 'YES'
              ? 'green'
              : outcome === 'NO'
              ? 'red'
              : outcome === 'CANCEL'
              ? 'yellow'
              : outcome === 'MKT'
              ? 'blue'
              : 'indigo'
          }
          label={
            outcome === 'CANCEL'
              ? 'N/A'
              : outcome === 'MKT'
              ? `${prob}%`
              : outcome ?? ''
          }
          marketTitle={contract.question}
          disabled={!outcome}
          onResolve={resolve}
          isSubmitting={isSubmitting}
        />
      </Row>
    </GradientContainer>
  )
}
