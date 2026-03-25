import { useMemo } from 'react';
import { Text, View } from 'react-native';
import { Asset } from '../../types';
import { formatCurrency } from '../../theme';
import { C } from '../../theme/colors';
import GlassCard from '../../components/GlassCard';
import MetricBox from '../../components/MetricBox';
import SectionHeading from '../../components/SectionHeading';
import EmptyState from '../../components/EmptyState';

type Props = { assets: Asset[] };

export default function AssetsSection({ assets }: Props) {
  const totalValue = useMemo(() => assets.reduce((s, a) => s + a.price, 0), [assets]);

  return (
    <>
      <GlassCard>
        <Text style={{ color: C.text, fontSize: 16, fontWeight: '700', marginBottom: 10 }}>
          Assets Dashboard
        </Text>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <MetricBox label="Total Assets" value={String(assets.length)} />
          <MetricBox label="Total Value" value={formatCurrency(totalValue)} />
        </View>
      </GlassCard>

      <SectionHeading title="Your Assets" />

      {assets.length === 0 ? (
        <EmptyState title="No assets yet" message="Add assets to track your net worth." />
      ) : (
        assets.map((asset) => (
          <GlassCard key={asset.id}>
            <Text style={{ color: C.text, fontWeight: '700', fontSize: 15 }}>{asset.title}</Text>
            <Text style={{ color: C.cyan, marginTop: 6, fontWeight: '700' }}>
              {formatCurrency(asset.price)}
            </Text>
          </GlassCard>
        ))
      )}
    </>
  );
}
