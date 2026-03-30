# @wyrd/reputation

Trust scoring engine for WYRD agents. Part of [WYRD](https://github.com/Fliegenbart/WYRD).

Weighted composite score (0-100) from task success rate, peer ratings, response speed, longevity, and consistency. Anti-gaming measures included.

```typescript
import { calculateReputation } from '@wyrd/reputation';

const score = calculateReputation({
  totalTasks: 100, successfulTasks: 95,
  avgRating: 4.5, totalRatings: 50,
  avgResponseMs: 500, ageDays: 90,
  ratingStdDev: 0.3, inactiveDays: 0,
});
// → { overall: 87, confidenceLevel: 'high', components: { ... } }
```

## License

MIT
