import Slider from 'rc-slider'
import clsx from 'clsx'
import React from 'react'
import { binaryOutcomes } from 'web/components/bet/bet-panel'
import { Col } from 'web/components/layout/col'
import { Row } from 'web/components/layout/row'
import { formatMoney } from 'common/util/format'

export const BetSlider = (props: {
  amount: number | undefined
  onAmountChange: (newAmount: number | undefined) => void
  binaryOutcome?: binaryOutcomes
}) => {
  const { amount, onAmountChange, binaryOutcome } = props

  const mark = (value: number) => (
    <span className="text-xs text-gray-400">
      <div className={'sm:h-0.5'} />
      {formatMoney(value)}
    </span>
  )

  return (
    <Col className={'mb-1 w-full'}>
      <Row className={'w-full'}>
        <Slider
          min={0}
          marks={{
            '0': mark(0),
            // '25': mark(25),
            '50': mark(50),
            // '75': mark(75),
            '100': mark(100),
          }}
          max={100}
          activeDotStyle={{
            borderColor:
              binaryOutcome === 'YES'
                ? 'teal'
                : binaryOutcome === 'NO'
                ? 'mediumvioletred'
                : 'blue',
          }}
          dotStyle={{ borderColor: 'lightgray' }}
          value={amount ?? 0}
          onChange={(value) => onAmountChange(value as number)}
          className={clsx(
            'my-auto mx-2 !h-1  xl:mx-2 xl:mt-3  [&>.rc-slider-rail]:bg-gray-200',
            '[&>.rc-slider-handle]:z-10',
            binaryOutcome === 'YES'
              ? '[&>.rc-slider-handle]:bg-teal-500 [&>.rc-slider-track]:bg-teal-600'
              : binaryOutcome === 'NO'
              ? '[&>.rc-slider-track]:bg-scarlet-600 [&>.rc-slider-handle]:bg-scarlet-300'
              : '[&>.rc-slider-handle]:bg-indigo-500 [&>.rc-slider-track]:bg-indigo-700'
          )}
          railStyle={{ height: 6, top: 4, left: 0 }}
          trackStyle={{ height: 6, top: 4 }}
          handleStyle={{
            height: 28,
            width: 28,
            opacity: 1,
            border: 'none',
            boxShadow: 'none',
            top: -2,
          }}
          step={5}
        />
      </Row>
    </Col>
  )
}
