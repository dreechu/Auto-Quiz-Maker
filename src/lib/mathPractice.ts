export type MathDifficulty = "Foundation" | "Intermediate" | "Advanced" | "Olympiad";
export type MathTopic =
  | "mixed"
  | "general"
  | "arithmetic"
  | "algebra"
  | "geometry"
  | "trigonometry"
  | "calculus"
  | "linear-algebra"
  | "differential-equations"
  | "probability"
  | "statistics"
  | "number-theory"
  | "discrete-math"
  | "combinatorics"
  | "precalculus"
  | "vectors"
  | "theorems";

export type GraphSpec =
  | { type: "line"; equation: string; slope: number; intercept: number }
  | { type: "parabola"; equation: string; a: number; b: number; c: number }
  | { type: "points"; equation: string; points: { x: number; y: number; label?: string }[] };

export type MathProblem = {
  topic: string;
  difficulty: MathDifficulty;
  question: string;
  choices: string[];
  answer: string;
  solution: string[];
  graph?: GraphSpec;
  source: "practice" | "ai";
};

export type MathLesson = {
  id: string;
  title: string;
  overview: string;
  keyIdeas: string[];
  example: string;
  practicePrompt: string;
};

export const MATH_TOPICS: { value: MathTopic; label: string }[] = [
  { value: "mixed", label: "Mixed practice" },
  { value: "general", label: "General mathematics" },
  { value: "arithmetic", label: "Arithmetic & number sense" },
  { value: "algebra", label: "Algebra" },
  { value: "geometry", label: "Geometry" },
  { value: "trigonometry", label: "Trigonometry" },
  { value: "precalculus", label: "Precalculus" },
  { value: "calculus", label: "Calculus" },
  { value: "differential-equations", label: "Differential equations" },
  { value: "linear-algebra", label: "Linear algebra" },
  { value: "vectors", label: "Vectors & complex numbers" },
  { value: "probability", label: "Probability" },
  { value: "statistics", label: "Statistics" },
  { value: "combinatorics", label: "Combinatorics" },
  { value: "number-theory", label: "Number theory" },
  { value: "discrete-math", label: "Discrete math & logic" },
  { value: "theorems", label: "Theorems & proofs" },
];

export const MATH_LESSONS: Record<Exclude<MathTopic, "mixed">, MathLesson[]> = {
  general: [
    { id: "number-sense", title: "Number sense & estimation", overview: "Compare quantities, reason about magnitude, and estimate before calculating.", keyIdeas: ["Use place value to compare numbers.", "Round to a useful scale, then check whether an answer is reasonable."], example: "Estimate 49 × 21 as 50 × 20 = 1,000 before finding the exact product.", practicePrompt: "number sense, place value, estimation, and checking whether results are reasonable" },
    { id: "order-of-operations", title: "Order of operations", overview: "Evaluate expressions consistently when several operations appear together.", keyIdeas: ["Evaluate grouping symbols first.", "Then exponents, then multiplication/division left to right, then addition/subtraction left to right."], example: "18 − 2 × 5 = 18 − 10 = 8; multiplication comes before subtraction.", practicePrompt: "multi-step order-of-operations expressions with parentheses, exponents, and negative values" },
    { id: "units-and-proportions", title: "Units & proportional reasoning", overview: "Use units and equivalent ratios to solve scale, rate, and conversion problems.", keyIdeas: ["Write units beside each quantity.", "Equivalent ratios preserve the same multiplicative relationship."], example: "At 60 km/h for 2.5 h, distance = 60 × 2.5 = 150 km.", practicePrompt: "unit conversions, rates, scale, and proportional reasoning" },
  ],
  arithmetic: [
    { id: "fractions", title: "Fractions & rational numbers", overview: "Add, subtract, multiply, and divide fractions while tracking equivalent values.", keyIdeas: ["Use a common denominator for addition and subtraction.", "Multiplication uses numerator-by-numerator; division multiplies by the reciprocal."], example: "3/4 ÷ 2/5 = 3/4 × 5/2 = 15/8.", practicePrompt: "operations with fractions, rational numbers, and simplifying results" },
    { id: "percent", title: "Percent change", overview: "Translate between percentages, fractions, and multipliers to reason about change.", keyIdeas: ["A p% increase multiplies by 1 + p/100.", "A p% decrease multiplies by 1 − p/100; successive changes compound."], example: "A 20% increase followed by a 20% decrease gives 1.2 × 0.8 = 0.96, a net 4% decrease.", practicePrompt: "successive percentage changes, discounts, markups, and reverse percentages" },
    { id: "ratios", title: "Ratios & rates", overview: "Compare quantities multiplicatively and solve for equivalent ratios.", keyIdeas: ["Keep corresponding quantities in a consistent order.", "A unit rate compares a quantity to one unit."], example: "If 4 notebooks cost $10, the unit price is $10 ÷ 4 = $2.50 per notebook.", practicePrompt: "multi-step ratio, rate, and unit-rate problems" },
  ],
  algebra: [
    { id: "linear-equations", title: "Linear equations & inequalities", overview: "Solve for an unknown while preserving equality and interpret solution constraints.", keyIdeas: ["Apply the same operation to both sides.", "Reverse the inequality when multiplying or dividing by a negative."], example: "3x − 7 = 11 → 3x = 18 → x = 6.", practicePrompt: "linear equations or inequalities with variables on both sides and explain each equivalent transformation" },
    { id: "quadratics", title: "Quadratics: factoring & roots", overview: "Connect a quadratic expression's factors, roots, and graph intercepts.", keyIdeas: ["If ab = 0, then a = 0 or b = 0.", "For ax² + bx + c, the discriminant b² − 4ac determines the real-root count."], example: "x² − 5x + 6 = (x − 2)(x − 3), so the roots are 2 and 3.", practicePrompt: "quadratic equations that require factoring, completing the square, or using the discriminant" },
    { id: "polynomials", title: "Polynomial operations", overview: "Combine like terms and use structure to expand or factor polynomial expressions.", keyIdeas: ["Only like powers of the same variable combine.", "Factoring reverses expansion and can reveal zeros."], example: "(x + 2)(x − 3) = x² − x − 6.", practicePrompt: "polynomial expansion, factorization, and identifying zeros" },
    { id: "functions", title: "Functions & transformations", overview: "Interpret functions as input-output rules and analyze how their graphs transform.", keyIdeas: ["The domain lists allowed inputs; the range lists resulting outputs.", "f(x − h) shifts a graph right by h; f(x) + k shifts it up by k."], example: "If f(x) = x², then g(x) = (x − 3)² + 2 has vertex (3, 2).", practicePrompt: "function notation, domains, composition, inverse functions, and graph transformations" },
  ],
  geometry: [
    { id: "euclidean-geometry", title: "Angles & Euclidean geometry", overview: "Use angle relationships and geometric constraints to derive unknown measures.", keyIdeas: ["Angles on a line sum to 180°; around a point sum to 360°.", "Parallel lines create equal corresponding and alternate interior angles."], example: "A triangle with angles 45° and 65° has third angle 180° − 110° = 70°.", practicePrompt: "multi-step angle-chasing problems using parallel lines and triangle angle sums" },
    { id: "coordinate-geometry", title: "Coordinate geometry & distance", overview: "Translate geometric relationships into coordinates and equations.", keyIdeas: ["Distance follows from the Pythagorean theorem.", "The midpoint averages the x-coordinates and y-coordinates."], example: "Between (−1, 2) and (3, 5), distance = √(4² + 3²) = 5.", practicePrompt: "coordinate geometry involving distance, midpoint, slope, or line equations and use a Cartesian illustration when useful" },
    { id: "circles", title: "Circles, arcs & sectors", overview: "Relate a circle's radius to circumference, area, and angular portions.", keyIdeas: ["Circumference C = 2πr; area A = πr².", "An arc or sector is the same fraction of the full circle as its central angle is of 360°."], example: "A 90° sector has one quarter of a circle's area: A = πr²/4.", practicePrompt: "circle geometry involving arcs, chords, tangents, sectors, circumference, or area" },
    { id: "similarity", title: "Similarity & scale factors", overview: "Use equal angles and proportional sides to relate similar shapes.", keyIdeas: ["Corresponding angles are equal and side lengths share one scale factor.", "Area scales by k² and volume by k³ when lengths scale by k."], example: "If corresponding side lengths scale by 3, areas scale by 9.", practicePrompt: "similar triangles, indirect measurement, and how length, area, or volume changes under scale" },
  ],
  trigonometry: [
    { id: "unit-circle", title: "Unit circle & exact values", overview: "Read sine and cosine as coordinates on the unit circle.", keyIdeas: ["A point at angle θ has coordinates (cos θ, sin θ).", "Use reference angles and quadrant signs to find exact values."], example: "At 150°, the reference angle is 30° in quadrant II, so sin 150° = 1/2 and cos 150° = −√3/2.", practicePrompt: "unit-circle exact values, reference angles, and signs by quadrant" },
    { id: "trig-identities", title: "Trigonometric identities", overview: "Transform equivalent trigonometric expressions using fundamental identities.", keyIdeas: ["sin²x + cos²x = 1.", "tan x = sin x / cos x where cos x ≠ 0."], example: "1 − cos²x = sin²x.", practicePrompt: "simplifying or proving trigonometric identities using Pythagorean, quotient, and angle-sum identities" },
    { id: "trig-equations", title: "Trigonometric equations", overview: "Solve for all angles in a specified interval, accounting for periodicity.", keyIdeas: ["Find reference angles and all matching quadrants.", "Check the interval and include every periodic solution."], example: "On [0°, 360°), sin θ = 1/2 at 30° and 150°.", practicePrompt: "trigonometric equations with all solutions in a specified interval" },
    { id: "triangle-trig", title: "Sine rule & cosine rule", overview: "Solve non-right triangles when right-triangle ratios are insufficient.", keyIdeas: ["The sine rule pairs each side with its opposite angle.", "The cosine rule generalizes Pythagoras to any triangle."], example: "c² = a² + b² − 2ab cos C.", practicePrompt: "non-right triangle problems using the sine rule, cosine rule, or area formula" },
  ],
  precalculus: [
    { id: "exponentials-logs", title: "Exponential & logarithmic functions", overview: "Use inverse relationships between exponential and logarithmic expressions.", keyIdeas: ["log_b(x) = y exactly when bʸ = x.", "Logarithm rules convert products to sums and powers to coefficients."], example: "log₂(32) = 5 because 2⁵ = 32.", practicePrompt: "exponential and logarithmic equations, growth, decay, and log laws" },
    { id: "sequences-series", title: "Sequences & series", overview: "Recognize patterns and calculate terms or sums in common sequences.", keyIdeas: ["Arithmetic sequences have constant difference.", "Geometric sequences have constant ratio."], example: "For an arithmetic sequence, aₙ = a₁ + (n − 1)d.", practicePrompt: "arithmetic or geometric sequences and finite-series sums" },
    { id: "conics", title: "Conic sections", overview: "Interpret standard equations for circles, parabolas, ellipses, and hyperbolas.", keyIdeas: ["Completing the square reveals a conic's center or vertex.", "The equation's squared terms determine the conic family."], example: "(x − 2)² + (y + 1)² = 9 is a circle centered at (2, −1) with radius 3.", practicePrompt: "conic sections, standard forms, vertices, foci, and graph interpretation" },
  ],
  calculus: [
    { id: "limits-continuity", title: "Limits & continuity", overview: "Describe function behavior near a point, including cases where direct substitution fails.", keyIdeas: ["A limit concerns nearby values, not necessarily the value at the point.", "Continuity requires the function value and two-sided limit to agree."], example: "For x ≠ 1, (x² − 1)/(x − 1) = x + 1, so the limit as x approaches 1 is 2.", practicePrompt: "limits, indeterminate forms, continuity, and removable or infinite discontinuities" },
    { id: "derivative-rules", title: "Derivatives & differentiation rules", overview: "Find instantaneous rates of change using derivative rules.", keyIdeas: ["Power rule: d(xⁿ)/dx = nxⁿ⁻¹.", "Product, quotient, and chain rules handle combined functions."], example: "d(3x² + sin x)/dx = 6x + cos x.", practicePrompt: "derivatives using the chain, product, quotient, and implicit differentiation rules" },
    { id: "derivative-applications", title: "Applications of derivatives", overview: "Use derivatives to analyze motion, extrema, and rates of change.", keyIdeas: ["Critical points occur where f′ = 0 or is undefined.", "The sign of f′ indicates increasing or decreasing behavior."], example: "For position s(t), velocity is s′(t) and acceleration is s″(t).", practicePrompt: "optimization, related rates, curve sketching, and motion applications of derivatives" },
    { id: "integrals", title: "Integrals & the fundamental theorem", overview: "Interpret definite integrals as accumulated signed area and antiderivatives.", keyIdeas: ["An antiderivative F satisfies F′ = f.", "∫ₐᵇ f(x)dx = F(b) − F(a)."], example: "∫₀² 3x² dx = [x³]₀² = 8.", practicePrompt: "definite and indefinite integration using substitution, area, and the fundamental theorem of calculus" },
    { id: "series", title: "Sequences, series & Taylor polynomials", overview: "Approximate functions and analyze convergence using infinite series.", keyIdeas: ["A geometric series converges when |r| < 1.", "Taylor polynomials use derivatives at a center to approximate nearby values."], example: "eˣ near 0 begins 1 + x + x²/2! + x³/3!.", practicePrompt: "Taylor or Maclaurin series, convergence tests, and error bounds" },
  ],
  "differential-equations": [
    { id: "separable-odes", title: "Separable first-order equations", overview: "Solve differential equations by separating dependent and independent variables.", keyIdeas: ["Rearrange to place all y terms with dy and x terms with dx.", "Integrate both sides and use initial conditions."], example: "y′ = ky gives dy/y = k dx and solution y = Ceᵏˣ.", practicePrompt: "separable first-order differential equations with initial conditions" },
    { id: "linear-odes", title: "First-order linear equations", overview: "Solve y′ + P(x)y = Q(x) using an integrating factor.", keyIdeas: ["The integrating factor is μ(x) = e^(∫P(x)dx).", "Then (μy)′ = μQ."], example: "For y′ + 2y = 0, μ = e²ˣ and y = Ce⁻²ˣ.", practicePrompt: "first-order linear differential equations solved using integrating factors" },
    { id: "second-order-odes", title: "Second-order linear equations", overview: "Solve constant-coefficient equations using the characteristic equation.", keyIdeas: ["Distinct real roots give combinations of exponentials.", "Repeated or complex roots require modified solution forms."], example: "y″ − 3y′ + 2y = 0 has roots 1 and 2, so y = C₁eˣ + C₂e²ˣ.", practicePrompt: "second-order constant-coefficient differential equations and their characteristic roots" },
  ],
  "linear-algebra": [
    { id: "linear-systems", title: "Systems & Gaussian elimination", overview: "Solve linear systems by row operations while preserving their solution set.", keyIdeas: ["Elementary row operations preserve equivalent systems.", "Reduced row echelon form reveals unique, infinite, or no solutions."], example: "Subtracting one equation from another can eliminate a shared variable.", practicePrompt: "solving and classifying systems of linear equations using row reduction" },
    { id: "matrix-operations", title: "Matrices & determinants", overview: "Represent linear transformations and compute matrix properties.", keyIdeas: ["Matrix multiplication is generally not commutative.", "A square matrix is invertible exactly when its determinant is nonzero."], example: "For [[a,b],[c,d]], det = ad − bc.", practicePrompt: "matrix multiplication, inverses, determinants, and their interpretations" },
    { id: "eigenvalues", title: "Eigenvalues & eigenvectors", overview: "Find directions preserved by a linear transformation and their scale factors.", keyIdeas: ["Av = λv for a nonzero vector v.", "Eigenvalues satisfy det(A − λI) = 0."], example: "For a diagonal matrix, each diagonal entry is an eigenvalue.", practicePrompt: "eigenvalues, eigenvectors, characteristic polynomials, and diagonalization" },
    { id: "vector-spaces", title: "Vector spaces & bases", overview: "Describe spans, independence, dimension, and coordinate representations.", keyIdeas: ["A basis is linearly independent and spans the space.", "The dimension is the number of vectors in any basis."], example: "The standard basis of R² is {(1,0),(0,1)}.", practicePrompt: "linear independence, span, basis, dimension, and subspaces" },
  ],
  "vectors": [
    { id: "dot-product", title: "Dot product & projections", overview: "Use the dot product to measure alignment and find projections.", keyIdeas: ["a·b = |a||b|cos θ.", "A zero dot product means perpendicular vectors."], example: "⟨1,2⟩·⟨3,−1⟩ = 3 − 2 = 1.", practicePrompt: "vector dot products, angles, orthogonality, and projections" },
    { id: "cross-product", title: "Cross product & area", overview: "Use the cross product to find a perpendicular vector and parallelogram area.", keyIdeas: ["a×b is perpendicular to both vectors in 3D.", "Its magnitude equals |a||b|sin θ."], example: "The area of a parallelogram spanned by a and b is |a×b|.", practicePrompt: "3D vector cross products, orientation, and geometric area" },
    { id: "complex-numbers", title: "Complex numbers & polar form", overview: "Represent complex numbers algebraically and geometrically in the plane.", keyIdeas: ["i² = −1; conjugates help divide complex numbers.", "Polar form uses modulus r and argument θ."], example: "3 + 4i has modulus √(3² + 4²) = 5.", practicePrompt: "complex-number operations, modulus, arguments, and polar form" },
  ],
  probability: [
    { id: "counting-probability", title: "Counting & sample spaces", overview: "Count outcomes carefully to calculate probabilities.", keyIdeas: ["For equally likely outcomes, P(A) = |A|/|S|.", "Use multiplication rules for successive independent choices."], example: "Two coin tosses have four equally likely outcomes.", practicePrompt: "counting sample spaces and calculating probabilities for multi-stage experiments" },
    { id: "conditional-probability", title: "Conditional probability & Bayes", overview: "Update probabilities when new information is known.", keyIdeas: ["P(A|B) = P(A∩B)/P(B).", "Bayes' theorem reverses conditioning using base rates."], example: "Do not confuse P(A|B) with P(B|A); they generally differ.", practicePrompt: "conditional probability, independence, and Bayes' theorem with realistic base rates" },
    { id: "random-variables", title: "Random variables & distributions", overview: "Model uncertain numerical outcomes and their long-run behavior.", keyIdeas: ["Expected value is the probability-weighted average.", "Variance measures spread around the mean."], example: "For a fair six-sided die, E[X] = (1+2+3+4+5+6)/6 = 3.5.", practicePrompt: "expected value, variance, binomial distributions, and probability mass functions" },
  ],
  statistics: [
    { id: "descriptive-statistics", title: "Center & spread", overview: "Summarize a dataset with measures of center and variability.", keyIdeas: ["Mean is sensitive to outliers; median is resistant.", "Standard deviation is measured in the data's original units."], example: "For 2, 4, 4, 10 the median is (4+4)/2 = 4.", practicePrompt: "mean, median, variance, standard deviation, and interpreting outliers" },
    { id: "sampling-inference", title: "Sampling & confidence intervals", overview: "Use sample data to estimate population quantities with quantified uncertainty.", keyIdeas: ["Larger random samples usually reduce standard error.", "A confidence interval describes a procedure's long-run coverage."], example: "A 95% confidence procedure captures the true parameter in about 95% of repeated samples.", practicePrompt: "sampling distributions, standard errors, and confidence-interval interpretation or calculation" },
    { id: "hypothesis-testing", title: "Hypothesis tests & p-values", overview: "Evaluate evidence against a null hypothesis using a defined test procedure.", keyIdeas: ["A p-value is computed assuming the null is true.", "Statistical significance does not by itself measure practical importance."], example: "A small p-value means the observed statistic would be unusual under the null model.", practicePrompt: "hypothesis tests, p-values, Type I and II errors, and interpretation" },
    { id: "regression", title: "Correlation & regression", overview: "Model association between variables without confusing correlation with causation.", keyIdeas: ["The least-squares line minimizes squared residuals.", "Extrapolation beyond observed data may be unreliable."], example: "A positive slope describes an increasing fitted relationship, not proof of causation.", practicePrompt: "linear regression, residuals, correlation, and limits of causal conclusions" },
  ],
  combinatorics: [
    { id: "permutations-combinations", title: "Permutations & combinations", overview: "Count arrangements when order matters or selections when order does not.", keyIdeas: ["Permutations: n!/(n−r)! when order matters.", "Combinations: n!/(r!(n−r)!) when order does not."], example: "Choosing 2 people from 5 gives C(5,2)=10 groups.", practicePrompt: "multi-step permutations and combinations, clearly identifying whether order matters" },
    { id: "pigeonhole", title: "Pigeonhole principle", overview: "Prove that a repeated category must occur when objects outnumber categories.", keyIdeas: ["Putting n+1 objects into n boxes forces a box to contain at least two.", "Generalized form guarantees at least ceil(N/k) objects in one of k boxes."], example: "Among 13 people, at least two share a birth month.", practicePrompt: "pigeonhole-principle existence proofs and extremal counting" },
    { id: "binomial-theorem", title: "Binomial theorem", overview: "Expand powers of sums and identify coefficients combinatorially.", keyIdeas: ["(x+y)ⁿ = Σ C(n,k)xⁿ⁻ᵏyᵏ.", "The coefficient C(n,k) counts choices of k factors contributing y."], example: "(x+y)³ = x³ + 3x²y + 3xy² + y³.", practicePrompt: "binomial expansions, coefficients, and combinatorial identities" },
  ],
  "number-theory": [
    { id: "divisibility-primes", title: "Divisibility & prime factorization", overview: "Use divisibility structure and prime factors to reason about integers.", keyIdeas: ["Every integer greater than 1 has a unique prime factorization.", "A prime divisor of n need not exceed √n."], example: "360 = 2³ × 3² × 5.", practicePrompt: "prime factorization, divisibility, gcd, and lcm" },
    { id: "modular-arithmetic", title: "Modular arithmetic", overview: "Compute remainders while preserving congruence relationships.", keyIdeas: ["If a ≡ b (mod n), compatible sums and products remain congruent.", "A multiplicative inverse exists modulo n only when the gcd is 1."], example: "17 ≡ 2 (mod 5), so 17² ≡ 2² ≡ 4 (mod 5).", practicePrompt: "modular arithmetic, congruences, inverses, and remainder reasoning" },
    { id: "euclidean-algorithm", title: "Euclidean algorithm & Bézout", overview: "Find greatest common divisors and express them as integer combinations.", keyIdeas: ["gcd(a,b) = gcd(b, a mod b).", "Bézout's identity writes gcd(a,b) = ax + by for integers x,y."], example: "gcd(30,18)=gcd(18,12)=gcd(12,6)=6.", practicePrompt: "Euclidean algorithm computations and Bézout coefficient problems" },
  ],
  "discrete-math": [
    { id: "propositional-logic", title: "Propositional logic", overview: "Evaluate compound statements and reason with logical equivalences.", keyIdeas: ["An implication is false only when its premise is true and conclusion false.", "A statement and its converse are not generally equivalent."], example: "The contrapositive of p⇒q is ¬q⇒¬p and is logically equivalent to it.", practicePrompt: "truth tables, logical equivalences, implication, converse, and contrapositive" },
    { id: "sets-relations", title: "Sets, relations & functions", overview: "Describe collections, mappings, and relation properties precisely.", keyIdeas: ["A function assigns each input exactly one output.", "Equivalence relations are reflexive, symmetric, and transitive."], example: "Congruence modulo n partitions integers into equivalence classes.", practicePrompt: "set operations, relations, equivalence classes, and function properties" },
    { id: "graph-theory", title: "Graph theory basics", overview: "Model pairwise connections and reason about paths, degrees, and trees.", keyIdeas: ["The sum of degrees in an undirected graph is 2|E|.", "A tree with n vertices has n−1 edges."], example: "A connected graph with no cycles is a tree.", practicePrompt: "graph theory degree counting, paths, trees, and connectivity" },
  ],
  theorems: [
    { id: "pythagorean-theorem", title: "Pythagorean theorem", overview: "Relate the side lengths of a right triangle and apply the converse.", keyIdeas: ["For legs a,b and hypotenuse c, a²+b²=c².", "If positive side lengths satisfy this equation, the included angle is right."], example: "A 5-12-13 triangle is right because 5² + 12² = 13².", practicePrompt: "applications and converse of the Pythagorean theorem, including coordinate geometry" },
    { id: "induction", title: "Proof by mathematical induction", overview: "Prove a statement for every natural number using a base case and inductive step.", keyIdeas: ["Verify the first case.", "Assume P(k), then derive P(k+1); state why this proves all cases."], example: "To prove 1+…+n=n(n+1)/2, use the formula at k and add k+1.", practicePrompt: "proofs by induction with a clearly stated base case, hypothesis, and inductive step" },
    { id: "fermat-euler", title: "Fermat's little theorem & Euler", overview: "Use modular exponentiation results for relatively prime integers.", keyIdeas: ["If p is prime and p does not divide a, then a^(p−1) ≡ 1 (mod p).", "Euler generalizes this using Euler's totient φ(n)."], example: "3⁴ ≡ 1 (mod 5).", practicePrompt: "Fermat's little theorem, Euler's theorem, and modular exponentiation" },
  ],
};

export const MATH_DIFFICULTIES: MathDifficulty[] = [
  "Foundation",
  "Intermediate",
  "Advanced",
  "Olympiad",
];

const rand = (min: number, max: number) =>
  Math.floor(Math.random() * (max - min + 1)) + min;

function shuffled<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = rand(0, i);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function makeChoices(answer: string, alternatives: string[]): string[] {
  const choices = [...new Set([answer, ...alternatives].filter(Boolean))].slice(0, 4);
  for (const fallback of ["None of the above", "All of the above", "Insufficient information"]) {
    if (choices.length === 4) break;
    if (!choices.includes(fallback)) choices.push(fallback);
  }
  return shuffled(choices);
}

function problem(
  topic: MathTopic,
  difficulty: MathDifficulty,
  question: string,
  answer: string,
  solution: string[],
  alternatives: string[],
  graph?: GraphSpec,
): MathProblem {
  const topicLabel = MATH_TOPICS.find((item) => item.value === topic)?.label ?? topic;
  return {
    topic: topicLabel,
    difficulty,
    question,
    answer,
    solution,
    choices: makeChoices(answer, alternatives),
    ...(graph ? { graph } : {}),
    source: "practice",
  };
}

function quadraticProblem(difficulty: MathDifficulty): MathProblem {
  const rootA = rand(-6, 6);
  let rootB = rand(-6, 6);
  while (rootA === rootB) rootB = rand(-6, 6);
  const sum = rootA + rootB;
  const product = rootA * rootB;
  const signed = (value: number) => value < 0 ? `− ${Math.abs(value)}` : `+ ${value}`;
  const answer = `{${Math.min(rootA, rootB)}, ${Math.max(rootA, rootB)}}`;
  const distractors = [
    `{${-sum}, ${product}}`,
    `{${sum}, ${-product}}`,
    `{${rootA + 1}, ${rootB + 1}}`,
  ];
  return problem(
    "algebra",
    difficulty,
    `Solve x² ${signed(-sum)}x ${signed(product)} = 0. Give the real roots as a set.`,
    answer,
    [
      `Factor the quadratic: (x ${signed(-rootA)})(x ${signed(-rootB)}) = 0.`,
      `Set each factor equal to zero, giving x = ${rootA} or x = ${rootB}.`,
      `Therefore the solution set is ${answer}.`,
    ],
    distractors,
  );
}

function makeProblem(topic: MathTopic, difficulty: MathDifficulty): MathProblem {
  const chosen = topic === "mixed"
    ? MATH_TOPICS[rand(1, MATH_TOPICS.length - 1)].value
    : topic;
  const advanced = difficulty === "Advanced" || difficulty === "Olympiad";

  if (chosen === "algebra") return quadraticProblem(difficulty);

  if (chosen === "general" || chosen === "arithmetic") {
    const a = rand(12, advanced ? 90 : 40);
    const b = rand(4, advanced ? 36 : 20);
    const divisor = rand(2, 12);
    const scaledB = b * divisor;
    const result = a * b;
    return problem(
      chosen,
      difficulty,
      `Evaluate ${a} × ${scaledB} ÷ ${divisor}, using the standard order of operations.`,
      String(result),
      [
        `Multiplication and division have equal precedence, so evaluate from left to right.`,
        `${a} × ${scaledB} = ${a * scaledB}.`,
        `${a * scaledB} ÷ ${divisor} = ${result}.`,
      ],
      [String(result + divisor), String(a * (b / divisor)), String(a + b - divisor)],
    );
  }

  if (chosen === "geometry") {
    const px = rand(-5, 4);
    const py = rand(-5, 4);
    const qx = px + rand(2, 5);
    const qy = py + rand(2, 5);
    const answer = String((qx - px) ** 2 + (qy - py) ** 2);
    return problem(
      chosen,
      difficulty,
      `Find the square of the distance between P(${px}, ${py}) and Q(${qx}, ${qy}).`,
      answer,
      [
        `Use d² = (x₂ − x₁)² + (y₂ − y₁)².`,
        `Substitute the coordinates: d² = (${qx} − ${px})² + (${qy} − ${py})².`,
        `Therefore d² = ${answer}.`,
      ],
      [String(Number(answer) + 2), String((qx - px) + (qy - py)), String(Number(answer) - 1)],
      {
        type: "points",
        equation: "Cartesian coordinate plane",
        points: [{ x: px, y: py, label: "P" }, { x: qx, y: qy, label: "Q" }],
      },
    );
  }

  if (chosen === "trigonometry") {
    const angles = [
      { angle: 15, value: "1/2", distractors: ["√3/2", "1", "0"] },
      { angle: 45, value: "√2/2", distractors: ["1/2", "√3/2", "1"] },
      { angle: 30, value: "1/2", distractors: ["√3/2", "√2/2", "0"] },
    ];
    const selected = angles[rand(0, angles.length - 1)];
    return problem(
      chosen,
      difficulty,
      `Using exact values, evaluate sin(2 × ${selected.angle}°).`,
      selected.value,
      [
        `First compute the angle: 2 × ${selected.angle}° = ${selected.angle * 2}°.`,
        `From the unit circle, sin(${selected.angle * 2}°) = ${selected.value}.`,
      ],
      selected.distractors,
    );
  }

  if (chosen === "calculus") {
    if (advanced) {
      const a = rand(1, 5);
      const b = rand(1, 7);
      const c = rand(1, 6);
      const answer = `f′(x) = ${2 * a}x + ${b}; slope at x = 1 is ${2 * a + b}`;
      const graph: GraphSpec = {
        type: "parabola",
        equation: `f(x) = ${a}x² + ${b}x + ${c}`,
        a,
        b,
        c,
      };
      return problem(
        chosen,
        difficulty,
        `For f(x) = ${a}x² + ${b}x + ${c}, find f′(x) and state the slope at x = 1.`,
        `f′(x) = ${a}x + ${b}; slope at x = 1 is ${a + b}`,
        [
          `Apply the power rule term by term: d/dx(${a}x²) = ${2 * a}x, d/dx(${b}x) = ${b}, and d/dx(${c}) = 0.`,
          `Thus f′(x) = ${2 * a}x + ${b}.`,
          `At x = 1, the slope is 2(${a}) + ${b} = ${2 * a + b}.`,
        ],
        [
          `f′(x) = ${a}x + ${b}; slope at x = 1 is ${a + b}`,
          `f′(x) = ${2 * a}x + ${b + 1}; slope at x = 1 is ${2 * a + b + 1}`,
          `f′(x) = ${2 * a}x + ${b}; slope at x = 1 is ${2 * a + b + 2}`,
        ],
        graph,
      );
    }
    const a = rand(2, 8);
    const b = rand(2, 9);
    const answer = `${3 * a}x² + ${2 * b}x`;
    return problem(
      chosen,
      difficulty,
      `Differentiate f(x) = ${a}x³ + ${b}x².`,
      answer,
      [
        `Apply the power rule d/dx(axⁿ) = anxⁿ⁻¹ to each term.`,
        `d/dx(${a}x³) = ${3 * a}x² and d/dx(${b}x²) = ${2 * b}x.`,
        `Therefore f′(x) = ${answer}.`,
      ],
      [`${a}x² + ${b}x`, `${3 * a}x³ + ${2 * b}x²`, `${3 * a}x² + ${b}x`],
      { type: "parabola", equation: `f′(x) = ${3 * a}x² + ${2 * b}x`, a: 3 * a, b: 2 * b, c: 0 },
    );
  }

  if (chosen === "linear-algebra") {
    const a = rand(1, 6), b = rand(1, 6), c = rand(1, 6), d = rand(1, 6);
    const answer = String(a * d - b * c);
    return problem(
      chosen,
      difficulty,
      `Compute the determinant of [[${a}, ${b}], [${c}, ${d}]].`,
      answer,
      [
        `For a 2 × 2 matrix [[a, b], [c, d]], det = ad − bc.`,
        `Substitute: (${a} × ${d}) − (${b} × ${c}) = ${a * d} − ${b * c}.`,
        `The determinant is ${answer}.`,
      ],
      [String(a * d + b * c), String(a + d - b - c), String(b * c - a * d)],
    );
  }

  if (chosen === "differential-equations") {
    const initial = rand(1, 5);
    const rate = rand(1, 4);
    const answer = `${initial}e^(${rate}x)`;
    return problem(
      chosen,
      difficulty,
      `Solve y′ = ${rate}y with initial condition y(0) = ${initial}.`,
      answer,
      [
        `Separate variables: dy/y = ${rate} dx.`,
        `Integrate: ln|y| = ${rate}x + C, so y = Ae^(${rate}x).`,
        `Apply y(0) = ${initial}; this gives A = ${initial}.`,
        `Therefore y = ${answer}.`,
      ],
      [`${initial + 1}e^(${rate}x)`, `${initial}e^x`, `${rate}e^(${initial}x)`],
    );
  }

  if (chosen === "probability") {
    const total = rand(8, advanced ? 30 : 16);
    const favorable = rand(2, total - 1);
    let common = favorable, remaining = total;
    while (remaining) [common, remaining] = [remaining, common % remaining];
    const answer = `${favorable / common}/${total / common}`;
    return problem(
      chosen,
      difficulty,
      `An experiment has ${total} equally likely outcomes, of which ${favorable} are favorable. What is the probability of a favorable outcome?`,
      answer,
      [
        `Probability = favorable outcomes ÷ total outcomes.`,
        `Substitute: P = ${favorable}/${total}.`,
        `Reduce by the greatest common divisor, ${common}: P = ${answer}.`,
      ],
      [`${total - favorable}/${total}`, `${favorable}/${total - 1}`, `${favorable + 1}/${total}`],
    );
  }

  if (chosen === "statistics") {
    const values = [rand(1, 9), rand(2, 12), rand(3, 14), rand(4, 15), rand(5, 18)].sort((a, b) => a - b);
    const answer = String(values[2]);
    return problem(
      chosen,
      difficulty,
      `Find the median of the data set: ${values.join(", ")}.`,
      answer,
      [
        `The data are already sorted: ${values.join(", ")}.`,
        `There are five observations, so the median is the third value.`,
        `The median is ${answer}.`,
      ],
      [String(values[1]), String(values[3]), String((values[0] + values[4]) / 2)],
    );
  }

  if (chosen === "combinatorics") {
    const n = rand(6, advanced ? 15 : 10);
    const k = rand(2, Math.min(4, n - 2));
    const choose = (top: number, bottom: number) => {
      let value = 1;
      for (let i = 1; i <= bottom; i++) value = value * (top - i + 1) / i;
      return value;
    };
    const answer = String(choose(n, k));
    return problem(
      chosen,
      difficulty,
      `How many distinct groups of ${k} can be selected from ${n} people if order does not matter?`,
      answer,
      [
        `Because order does not matter, use combinations: C(${n}, ${k}) = ${n}! / (${k}!(${n - k})!).`,
        `Cancel common factors and evaluate the product.`,
        `The number of groups is ${answer}.`,
      ],
      [String(choose(n, k) * k), String(n ** k), String(choose(n - 1, k))],
    );
  }

  if (chosen === "number-theory") {
    const a = rand(40, 160);
    const b = rand(15, 80);
    let x = a, y = b;
    while (y) [x, y] = [y, x % y];
    return problem(
      chosen,
      difficulty,
      `Use the Euclidean algorithm to find gcd(${a}, ${b}).`,
      String(x),
      [
        `Apply Euclid's algorithm by repeatedly replacing (a, b) with (b, a mod b).`,
        `The final nonzero remainder is ${x}.`,
        `Therefore gcd(${a}, ${b}) = ${x}.`,
      ],
      [String(x + 1), String(Math.max(1, x - 1)), String(a % b)],
    );
  }

  if (chosen === "discrete-math") {
    const answer = "False";
    return problem(
      chosen,
      difficulty,
      "Is the implication (p ⇒ q) logically equivalent to its converse (q ⇒ p) for all truth values?",
      answer,
      [
        "An implication and its converse are not generally equivalent.",
        "Take p = true and q = false: p ⇒ q is false, while q ⇒ p is true.",
        "Since they differ for this assignment, the equivalence claim is false.",
      ],
      ["True", "Only when p is false", "Only when q is true"],
    );
  }

  if (chosen === "precalculus") {
    const base = rand(2, 5);
    const exponent = rand(2, 5);
    const answer = String(exponent);
    return problem(
      chosen,
      difficulty,
      `Solve ${base}ˣ = ${base ** exponent} for real x.`,
      answer,
      [
        `Take logarithm base ${base} on both sides: x = log_${base}(${base ** exponent}).`,
        `Since ${base ** exponent} = ${base}^${exponent}, the logarithm is ${exponent}.`,
        `Thus x = ${exponent}.`,
      ],
      [String(exponent + 1), String(exponent - 1), String(base ** exponent)],
    );
  }

  if (chosen === "vectors") {
    let ax = rand(-8, 8), ay = rand(-8, 8), bx = rand(-8, 8), by = rand(-8, 8);
    if (ax === 0 && ay === 0) ax = 1;
    if (bx === 0 && by === 0) by = 1;
    const answer = String(ax * bx + ay * by);
    return problem(
      chosen,
      difficulty,
      `Find the dot product of vectors a = ⟨${ax}, ${ay}⟩ and b = ⟨${bx}, ${by}⟩.`,
      answer,
      [
        `Use a · b = a₁b₁ + a₂b₂.`,
        `Substitute: (${ax})(${bx}) + (${ay})(${by}) = ${ax * bx} + ${ay * by}.`,
        `The dot product is ${answer}.`,
      ],
      [String(ax * bx - ay * by), String((ax + ay) * (bx + by)), String(ax * by + ay * bx)],
      { type: "points", equation: "Vectors from the origin", points: [{ x: ax, y: ay, label: "a" }, { x: bx, y: by, label: "b" }] },
    );
  }

  if (chosen === "theorems") {
    const a = rand(3, 8), b = rand(3, 8);
    const cSquared = a * a + b * b;
    return problem(
      chosen,
      difficulty,
      `A right triangle has legs ${a} and ${b}. Use the Pythagorean theorem to find the hypotenuse.`,
      `√${cSquared}`,
      [
        `The Pythagorean theorem states a² + b² = c² for a right triangle.`,
        `Substitute the leg lengths: c² = ${a}² + ${b}² = ${cSquared}.`,
        `Since a length is positive, c = √${cSquared}.`,
      ],
      [String(cSquared), `√${a * a + b}`, `√${a + b}`],
      { type: "points", equation: "Right triangle legs", points: [{ x: 0, y: 0, label: "A" }, { x: a, y: 0, label: "B" }, { x: 0, y: b, label: "C" }] },
    );
  }

  return makeProblem("calculus", difficulty);
}

export function generatePracticeProblem(topic: MathTopic, difficulty: MathDifficulty) {
  return makeProblem(topic, difficulty);
}
